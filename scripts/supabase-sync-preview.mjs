#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { createClient } from "@supabase/supabase-js";
import {
  createSafeStorageOperationError,
  formatStorageError,
  getPreviewStorageBucketName,
  isInvalidPreviewRequiredStorageBucket,
  isPreviewRequiredStorageBucket,
  runStorageOperation,
  shouldAbortPreviewStorageObjectSync,
  shouldSyncPreviewStorageBucket,
} from "./supabase-sync-preview-storage.mjs";
import { isMissingSupabasePoolerTenantErrorMessage } from "./supabase-db-health-lib.mjs";
import {
  hashPreviewSeedPassword,
  isValidPreviewSeedPassword,
  resolvePreviewMemberCredentialSeedTarget,
  resolvePreviewMemberCredentialSeedConfig,
} from "./preview-credential-seed-lib.mjs";
import {
  buildTransactionalPreviewRestoreSql,
  sanitizeDumpSqlForPreview,
  stripUnsupportedPreviewRestoreTriggerControls,
} from "./supabase-sync-preview-lib.mjs";
import {
  buildProductionDataDumpContainerPlan,
  filterPgDumpCircularForeignKeyWarnings,
} from "./supabase-sync-preview-dump-lib.mjs";

const PUBLIC_SCHEMA = "public";
const CHECK_ONLY_FLAG = "--check-only";
const DEFAULT_CACHE_CONTROL = "31536000";
const PREVIEW_LOCAL_WALLET_TABLES = [
  // Dependency order is also the restore order after the Production data import.
  "member_wallet_passes",
  "member_wallet_pass_revisions",
  "apple_wallet_device_registrations",
  "member_wallet_pass_operations",
];
const EXCLUDED_PUBLIC_TABLES = [
  "admin_login_attempts",
  "admin_audit_logs",
  // Production Wallet credentials and APNs registrations must never enter Preview.
  ...PREVIEW_LOCAL_WALLET_TABLES,
  "auth_security_logs",
  "event_logs",
  "member_auth_attempts",
  "password_reset_attempts",
  "partner_auth_attempts",
  "push_delivery_logs",
  "push_message_logs",
  "push_preferences",
  "push_subscriptions",
  "suggestion_attempts",
];
const PREVIEW_ADMIN_PERMISSION_SEED_SQL = `
create table if not exists public.admin_permission_templates (
  key text primary key,
  name text not null,
  description text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

insert into public.admin_permission_templates (key, name, description, permissions)
values
  ('super_admin', 'Super Admin', '멤버 관리자 권한과 전체 운영 권한을 관리합니다.', '{"members":{"create":true,"read":true,"update":true,"delete":true},"reviews":{"create":true,"read":true,"update":true,"delete":true},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"notifications":{"create":true,"read":true,"update":true,"delete":true},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":true,"read":true,"update":true,"delete":true},"admin_management":{"create":true,"read":true,"update":true,"delete":true}}'::jsonb),
  ('operations_manager', '운영 관리자', '회원, 협력사, 알림, 이벤트, 기수 운영을 담당합니다.', '{"members":{"create":true,"read":true,"update":true,"delete":true},"reviews":{"create":false,"read":true,"update":true,"delete":true},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":true,"read":true,"update":true,"delete":true},"notifications":{"create":true,"read":true,"update":true,"delete":true},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":false,"read":true,"update":true,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('content_manager', '콘텐츠 관리자', '브랜드, 홈광고, 이벤트 노출 콘텐츠를 관리합니다.', '{"members":{"create":false,"read":false,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":true,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":true,"read":true,"update":true,"delete":true},"companies":{"create":false,"read":false,"update":false,"delete":false},"notifications":{"create":false,"read":false,"update":false,"delete":false},"home_ads":{"create":true,"read":true,"update":true,"delete":true},"events":{"create":true,"read":true,"update":true,"delete":true},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('support', '고객지원', '회원과 리뷰 상태를 확인하고 필요한 조치를 수행합니다.', '{"members":{"create":false,"read":true,"update":true,"delete":false},"reviews":{"create":false,"read":true,"update":true,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":false,"read":true,"update":false,"delete":false},"companies":{"create":false,"read":true,"update":false,"delete":false},"notifications":{"create":false,"read":true,"update":false,"delete":false},"home_ads":{"create":false,"read":false,"update":false,"delete":false},"events":{"create":false,"read":true,"update":false,"delete":false},"cycles":{"create":false,"read":false,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb),
  ('readonly', '조회 전용', '운영 데이터를 조회만 할 수 있습니다.', '{"members":{"create":false,"read":true,"update":false,"delete":false},"reviews":{"create":false,"read":true,"update":false,"delete":false},"logs":{"create":false,"read":true,"update":false,"delete":false},"brands":{"create":false,"read":true,"update":false,"delete":false},"companies":{"create":false,"read":true,"update":false,"delete":false},"notifications":{"create":false,"read":true,"update":false,"delete":false},"home_ads":{"create":false,"read":true,"update":false,"delete":false},"events":{"create":false,"read":true,"update":false,"delete":false},"cycles":{"create":false,"read":true,"update":false,"delete":false},"admin_management":{"create":false,"read":false,"update":false,"delete":false}}'::jsonb)
on conflict (key) do update
   set name = excluded.name,
       description = excluded.description,
       permissions = excluded.permissions,
       updated_at = now();

insert into public.admin_profiles (
  member_id,
  permission_template_key,
  managed_campus_slugs,
  is_active,
  updated_at
)
select
  member.id,
  'super_admin',
  '{}',
  true,
  now()
from public.members member
join public.mm_user_directory directory
  on directory.id = member.mattermost_account_id
where directory.mm_username = 'myknow'
  and member.deleted_at is null
on conflict (member_id) do update
set permission_template_key = excluded.permission_template_key,
    is_active = true,
    updated_at = now();
`;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

function isTruthyEnv(name) {
  return ["1", "true", "yes", "on"].includes(
    (process.env[name] ?? "").trim().toLowerCase(),
  );
}

async function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

function runCommand(command, args, options = {}) {
  const {
    captureStdout = false,
    captureStderr = true,
    env = {},
    stdoutPath,
    transformStderr,
  } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settleFailure = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const stdoutFile = stdoutPath ? createWriteStream(stdoutPath, { flags: "w" }) : null;
    const stdoutFinished = stdoutFile ? finished(stdoutFile) : null;
    const child = spawn(command, args, {
      stdio: [
        "ignore",
        captureStdout || stdoutFile ? "pipe" : "inherit",
        captureStderr ? "pipe" : "inherit",
      ],
      env: {
        ...process.env,
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";

    if (captureStdout && child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
    }

    if (stdoutFile && child.stdout) {
      child.stdout.pipe(stdoutFile);
    }

    if (captureStderr && child.stderr) {
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        stderr += text;
        if (!transformStderr) {
          process.stderr.write(text);
        }
      });
    }

    child.once("error", (error) => {
      stdoutFile?.destroy(error);
      void stdoutFinished?.catch(() => undefined);
      settleFailure(error);
    });
    child.once("close", async (code) => {
      if (settled) {
        return;
      }

      try {
        await stdoutFinished;
      } catch (error) {
        settleFailure(error);
        return;
      }

      let reportedStderr;
      try {
        reportedStderr = transformStderr ? transformStderr(stderr) : stderr;
      } catch (error) {
        settleFailure(error);
        return;
      }

      if (transformStderr && reportedStderr) {
        process.stderr.write(reportedStderr);
      }

      if (code !== 0) {
        settleFailure(
          new Error(reportedStderr.trim() || `${command} failed with exit code ${code}`),
        );
        return;
      }

      settled = true;
      resolve({ stdout, stderr: reportedStderr });
    });
  });
}

function createStorageClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
        }),
    },
  });
}

async function listPublicTables(dbUrl) {
  const { stdout } = await runCommand(
    "psql",
    [
      "--dbname",
      dbUrl,
      "--tuples-only",
      "--no-align",
      "--command",
      `select tablename from pg_tables where schemaname = '${PUBLIC_SCHEMA}' order by tablename;`,
    ],
    {
      captureStdout: true,
    },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function listPublicTableColumns(dbUrl) {
  const { stdout } = await runCommand(
    "psql",
    [
      "--dbname",
      dbUrl,
      "--tuples-only",
      "--no-align",
      "--command",
      `select table_name || '|' || string_agg(column_name, ',' order by ordinal_position)
       from information_schema.columns
       where table_schema = '${PUBLIC_SCHEMA}'
       group by table_name
       order by table_name;`,
    ],
    {
      captureStdout: true,
    },
  );

  return new Map(
    stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf("|");
        const table = line.slice(0, separatorIndex);
        const rawColumns = line.slice(separatorIndex + 1);
        return [
          table,
          new Set(rawColumns.split(",").map((column) => column.trim()).filter(Boolean)),
        ];
      }),
  );
}

async function dumpProductionDatabase(dumpPath, productionDbUrl) {
  const plan = buildProductionDataDumpContainerPlan({
    productionDbUrl,
    schema: PUBLIC_SCHEMA,
    excludedTables: EXCLUDED_PUBLIC_TABLES,
  });

  console.log("Syncing production public data dump with the pinned PostgreSQL 17 client...");
  await runCommand(plan.command, plan.args, {
    env: plan.environment,
    stdoutPath: dumpPath,
    transformStderr: filterPgDumpCircularForeignKeyWarnings,
  });
}

async function assertPreviewDatabaseAvailable(previewDbUrl) {
  await runCommand(
    "psql",
    [
      "--dbname",
      previewDbUrl,
      "--tuples-only",
      "--no-align",
      "--command",
      "select 1;",
    ],
    {
      captureStdout: true,
      env: {
        PGCONNECT_TIMEOUT: "10",
      },
    },
  );
}

async function sanitizeDumpForPreview(dumpPath, previewDbUrl) {
  const previewColumnsByTable = await listPublicTableColumns(previewDbUrl);
  const sourceSql = await readFile(dumpPath, "utf8");
  const sanitized = sanitizeDumpSqlForPreview(sourceSql, previewColumnsByTable);
  const triggerControlSanitized = stripUnsupportedPreviewRestoreTriggerControls(
    sanitized.sql,
  );
  const { stats } = sanitized;

  if (stats.memberCopyBlocksSeen > 0) {
    console.log(
      [
        "Preview sync member credential sanitization:",
        `memberCopyBlocksSeen=${stats.memberCopyBlocksSeen}`,
        `memberRowsSeen=${stats.memberRowsSeen}`,
        `memberPasswordRowsStripped=${stats.memberPasswordRowsStripped}`,
        "production password hashes are intentionally not restored to preview; use preview reset/test credentials.",
      ].join(" "),
    );
  }

  if (stats.partnerCopyBlocksSeen > 0) {
    console.log(
      [
        "Preview sync partner campus diagnostics:",
        `partnerCopyBlocksSeen=${stats.partnerCopyBlocksSeen}`,
        `partnerRowsSeen=${stats.partnerRowsSeen}`,
        `partnerCampusSlugsAppended=${stats.partnerCampusSlugsAppended}`,
        `partnerCampusSlugsBackfilled=${stats.partnerCampusSlugsBackfilled}`,
        `partnerRowsSkippedColumnMismatch=${stats.partnerRowsSkippedColumnMismatch}`,
        `unresolvedPartnerCampusSlugRows=${stats.unresolvedPartnerCampusSlugRows}`,
      ].join(" "),
    );
  }

  if (stats.partnerChangeRequestCopyBlocksSeen > 0) {
    console.log(
      [
        "Preview sync partner change request campus diagnostics:",
        `partnerChangeRequestCopyBlocksSeen=${stats.partnerChangeRequestCopyBlocksSeen}`,
        `partnerChangeRequestRowsSeen=${stats.partnerChangeRequestRowsSeen}`,
        `partnerChangeRequestCampusSlugsAppended=${stats.partnerChangeRequestCampusSlugsAppended}`,
        `partnerChangeRequestCampusSlugsBackfilled=${stats.partnerChangeRequestCampusSlugsBackfilled}`,
        `partnerChangeRequestRowsSkippedColumnMismatch=${stats.partnerChangeRequestRowsSkippedColumnMismatch}`,
        `unresolvedPartnerChangeRequestCampusSlugRows=${stats.unresolvedPartnerChangeRequestCampusSlugRows}`,
      ].join(" "),
    );
  }

  if (stats.missingPreviewTableCopyBlocksSkipped > 0) {
    console.log(
      [
        "Preview sync missing table diagnostics:",
        `missingPreviewTableCopyBlocksSkipped=${stats.missingPreviewTableCopyBlocksSkipped}`,
        `missingPreviewTableRowsSkipped=${stats.missingPreviewTableRowsSkipped}`,
        "production-only public tables are omitted from preview restore.",
      ].join(" "),
    );
  }

  if (stats.unresolvedPartnerCampusSlugRows > 0) {
    throw new Error(
      `Preview dump still has ${stats.unresolvedPartnerCampusSlugRows} partner row(s) that can violate partners_campus_slugs_check after sanitizing.`,
    );
  }

  if (stats.unresolvedPartnerChangeRequestCampusSlugRows > 0) {
    throw new Error(
      `Preview dump still has ${stats.unresolvedPartnerChangeRequestCampusSlugRows} partner_change_requests row(s) that can violate campus slug checks after sanitizing.`,
    );
  }

  if (triggerControlSanitized.removedCount > 0) {
    console.log(
      [
        "Preview sync trigger restore sanitization:",
        `unsupportedPublicTriggerControlsRemoved=${triggerControlSanitized.removedCount}`,
        "session-level constraint handling remains enabled.",
      ].join(" "),
    );
  }

  if (!sanitized.changed && triggerControlSanitized.removedCount === 0) {
    return;
  }

  console.log("Sanitizing production dump for preview schema differences...");
  await writeFile(dumpPath, triggerControlSanitized.sql, "utf8");
}

async function replacePreviewDatabaseData(dumpPath, restorePath, previewDbUrl) {
  const tables = await listPublicTables(previewDbUrl);
  const targetTables = tables.filter((table) => !EXCLUDED_PUBLIC_TABLES.includes(table));
  const missingWalletTables = PREVIEW_LOCAL_WALLET_TABLES.filter(
    (table) => !tables.includes(table),
  );

  if (missingWalletTables.length > 0) {
    throw new Error(
      `Preview Wallet schema is missing ${missingWalletTables.length} required table(s); apply migrations before data sync.`,
    );
  }

  if (!targetTables.length) {
    console.log("No preview public tables to replace.");
    return;
  }

  const productionDumpSql = await readFile(dumpPath, "utf8");
  const restoreSql = buildTransactionalPreviewRestoreSql({
    productionDumpSql,
    schema: PUBLIC_SCHEMA,
    targetTables,
    preservedTables: PREVIEW_LOCAL_WALLET_TABLES,
  });
  await writeFile(restorePath, restoreSql, "utf8");

  console.log(
    `Replacing ${targetTables.length} Preview public tables while preserving local Wallet records...`,
  );
  await runCommand(
    "psql",
    [
      "--dbname",
      previewDbUrl,
      "--set",
      "ON_ERROR_STOP=1",
      "--single-transaction",
      "--file",
      restorePath,
    ],
  );
}

async function seedPreviewAdminPermissions(previewDbUrl) {
  console.log("Seeding preview admin permission templates and myknow super admin access...");
  await runCommand(
    "psql",
    [
      "--dbname",
      previewDbUrl,
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      PREVIEW_ADMIN_PERMISSION_SEED_SQL,
    ],
  );
}

async function seedPreviewMemberCredentials(previewUrl, previewServiceRoleKey) {
  const seedConfig = resolvePreviewMemberCredentialSeedConfig();
  if (!seedConfig) {
    console.log(
      "Skipping preview member credential seed: PREVIEW_TEST_MEMBER_USERNAME/PREVIEW_TEST_MEMBER_PASSWORD are not set.",
    );
    return;
  }

  if (!isValidPreviewSeedPassword(seedConfig.password)) {
    throw new Error(
      "PREVIEW_TEST_MEMBER_PASSWORD must be 8-64 characters and include letters, numbers, and symbols.",
    );
  }

  const previewClient = createStorageClient(previewUrl, previewServiceRoleKey);
  const member = await resolvePreviewMemberCredentialSeedTarget(
    {
      async findDirectoryByUsername(username) {
        const { data, error } = await previewClient
          .from("mm_user_directory")
          .select("id")
          .eq("mm_username", username)
          .eq("is_active", true)
          .maybeSingle();
        if (error) {
          throw error;
        }
        return data;
      },
      async findActiveMemberByMattermostAccountId(directoryId) {
        const { data, error } = await previewClient
          .from("members")
          .select("id")
          .eq("mattermost_account_id", directoryId)
          .is("deleted_at", null)
          .maybeSingle();
        if (error) {
          throw error;
        }
        return data;
      },
    },
    seedConfig.username,
  );

  const passwordRecord = hashPreviewSeedPassword(seedConfig.password);
  const updatedAt = new Date().toISOString();
  const { error: updateError } = await previewClient
    .from("members")
    .update({
      password_hash: passwordRecord.hash,
      password_salt: passwordRecord.salt,
      must_change_password: false,
      updated_at: updatedAt,
    })
    .eq("id", member.id);

  if (updateError) {
    throw updateError;
  }

  console.log(
    "Seeded one Preview-only member credential. Production password hashes remain stripped.",
  );
}

function bucketNameFrom(bucket) {
  return getPreviewStorageBucketName(bucket);
}

function isFolderEntry(entry) {
  return !entry.metadata;
}

function joinStoragePath(prefix, name) {
  return prefix ? `${prefix}/${name}` : name;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function collectBucketFilePaths(storageClient, bucketName, prefix = "", paths = new Set()) {
  const limit = 1000;
  let offset = 0;

  while (true) {
    const data = await runStorageOperation(
      `Listing preview objects in ${bucketName}`,
      () =>
        storageClient.storage.from(bucketName).list(prefix, {
          limit,
          offset,
          sortBy: {
            column: "name",
            order: "asc",
          },
        }),
    );

    const entries = data ?? [];
    if (entries.length === 0) {
      return paths;
    }

    for (const entry of entries) {
      const objectPath = joinStoragePath(prefix, entry.name);
      if (isFolderEntry(entry)) {
        await collectBucketFilePaths(storageClient, bucketName, objectPath, paths);
        continue;
      }
      paths.add(objectPath);
    }

    if (entries.length < limit) {
      return paths;
    }

    offset += limit;
  }
}

async function ensureBucket(previewClient, bucket, previewBucketsByName) {
  const bucketName = bucketNameFrom(bucket);
  if (!bucketName) {
    return;
  }
  const previewBucket = previewBucketsByName.get(bucketName) ?? null;

  const options = {
    public: Boolean(bucket.public),
    ...(Array.isArray(bucket.allowed_mime_types)
      ? { allowedMimeTypes: bucket.allowed_mime_types }
      : {}),
    ...(typeof bucket.file_size_limit === "number"
      ? { fileSizeLimit: bucket.file_size_limit }
      : {}),
  };

  if (!previewBucket) {
    console.log(`Creating preview bucket: ${bucketName}`);
    await runStorageOperation(`Creating preview bucket ${bucketName}`, () =>
      previewClient.storage.createBucket(bucketName, options),
    );
    return;
  }

  const needsUpdate =
    Boolean(previewBucket.public) !== Boolean(bucket.public) ||
    JSON.stringify(previewBucket.allowed_mime_types ?? []) !==
      JSON.stringify(bucket.allowed_mime_types ?? []) ||
    Number(previewBucket.file_size_limit ?? 0) !== Number(bucket.file_size_limit ?? 0);

  if (!needsUpdate) {
    return;
  }

  console.log(`Updating preview bucket: ${bucketName}`);
  await runStorageOperation(`Updating preview bucket ${bucketName}`, () =>
    previewClient.storage.updateBucket(bucketName, options),
  );
}

async function syncBucketPrefix(prodClient, previewClient, bucketName, prefix = "") {
  const limit = 1000;
  let offset = 0;

  while (true) {
    const data = await runStorageOperation(
      `Listing production objects in ${bucketName}`,
      () =>
        prodClient.storage.from(bucketName).list(prefix, {
          limit,
          offset,
          sortBy: {
            column: "name",
            order: "asc",
          },
        }),
    );

    const entries = data ?? [];
    if (entries.length === 0) {
      return;
    }

    for (const entry of entries) {
      const objectPath = joinStoragePath(prefix, entry.name);
      if (isFolderEntry(entry)) {
        await syncBucketPrefix(prodClient, previewClient, bucketName, objectPath);
        continue;
      }

      try {
        const file = await runStorageOperation(
          `Downloading object from ${bucketName}`,
          () => prodClient.storage.from(bucketName).download(objectPath),
        );

        if (!file) {
          throw new Error("STORAGE_OBJECT_DOWNLOAD_EMPTY");
        }

        const contentType =
          file.type ||
          entry.metadata?.mimetype ||
          entry.metadata?.content_type ||
          "application/octet-stream";

        const buffer = Buffer.from(await file.arrayBuffer());
        await runStorageOperation(
          `Uploading object to ${bucketName}`,
          () =>
            previewClient.storage.from(bucketName).upload(objectPath, buffer, {
              contentType,
              cacheControl: DEFAULT_CACHE_CONTROL,
              upsert: true,
            }),
        );
      } catch (error) {
        if (shouldAbortPreviewStorageObjectSync(bucketName)) {
          throw createSafeStorageOperationError(
            `Preview required object in ${bucketName} could not be synchronized`,
            error,
          );
        }
        console.warn(
          `Skipping one object in ${bucketName} after storage sync failure: ${formatStorageError(error)}`,
        );
      }
    }

    if (entries.length < limit) {
      return;
    }

    offset += limit;
  }
}

async function removePreviewOnlyObjects(prodClient, previewClient, bucketName) {
  const sourcePaths = await collectBucketFilePaths(prodClient, bucketName);
  const previewPaths = await collectBucketFilePaths(previewClient, bucketName);
  const missingPaths = [...sourcePaths].filter(
    (path) => !previewPaths.has(path),
  );
  if (isPreviewRequiredStorageBucket(bucketName) && missingPaths.length > 0) {
    throw new Error(
      `Preview required bucket ${bucketName} is missing ${missingPaths.length} synchronized object(s).`,
    );
  }
  const extraPaths = [...previewPaths].filter(
    (path) => !sourcePaths.has(path),
  );

  if (extraPaths.length === 0) {
    return;
  }

  console.log(`Removing ${extraPaths.length} stale preview objects from ${bucketName}`);
  for (const batch of chunkArray(extraPaths, 100)) {
    await runStorageOperation(`Removing preview objects from ${bucketName}`, () =>
      previewClient.storage.from(bucketName).remove(batch),
    );
  }
}

async function syncStorageBuckets(productionUrl, productionServiceRoleKey, previewUrl, previewServiceRoleKey) {
  const prodClient = createStorageClient(productionUrl, productionServiceRoleKey);
  const previewClient = createStorageClient(previewUrl, previewServiceRoleKey);

  let prodBuckets;
  try {
    prodBuckets = await runStorageOperation("Listing production buckets", () =>
      prodClient.storage.listBuckets(),
    );
  } catch (error) {
    throw createSafeStorageOperationError(
      "Production storage buckets could not be listed",
      error,
    );
  }

  const discoveredBuckets = prodBuckets ?? [];
  if (discoveredBuckets.some(isInvalidPreviewRequiredStorageBucket)) {
    throw new Error(
      "Preview required storage bucket member-profile-images must have consistent private bucket metadata.",
    );
  }
  const buckets = discoveredBuckets.filter(shouldSyncPreviewStorageBucket);
  const skippedBucketCount = discoveredBuckets.length - buckets.length;
  if (skippedBucketCount > 0) {
    console.log(
      `Skipping ${skippedBucketCount} private or malformed production storage bucket(s) outside the Preview allowlist.`,
    );
  }
  if (buckets.length === 0) {
    console.log("No eligible production buckets found. Skipping storage sync.");
    return;
  }

  let previewBuckets;
  try {
    previewBuckets = await runStorageOperation("Listing preview buckets", () =>
      previewClient.storage.listBuckets(),
    );
  } catch (error) {
    throw createSafeStorageOperationError(
      "Preview storage buckets could not be listed",
      error,
    );
  }

  const previewBucketsByName = new Map(
    (previewBuckets ?? [])
      .map((bucket) => {
        const bucketName = bucketNameFrom(bucket);
        return bucketName ? [bucketName, bucket] : null;
      })
      .filter((item) => item !== null),
  );

  for (const bucket of buckets) {
    const bucketName = bucketNameFrom(bucket);
    if (!bucketName) {
      continue;
    }

    try {
      await ensureBucket(previewClient, bucket, previewBucketsByName);
      console.log(`Syncing bucket: ${bucketName}`);
      await syncBucketPrefix(prodClient, previewClient, bucketName);
      try {
        await removePreviewOnlyObjects(prodClient, previewClient, bucketName);
      } catch (error) {
        if (isPreviewRequiredStorageBucket(bucketName)) {
          throw error;
        }
        console.warn(
          `Skipping stale-object cleanup for ${bucketName}: ${formatStorageError(error)}`,
        );
      }
    } catch (error) {
      if (isPreviewRequiredStorageBucket(bucketName)) {
        throw createSafeStorageOperationError(
          "Preview member profile image storage could not be synchronized",
          error,
        );
      }
      console.warn(`Skipping bucket ${bucketName} after storage sync failure: ${formatStorageError(error)}`);
    }
  }
}

async function main() {
  const checkOnly = process.argv.includes(CHECK_ONLY_FLAG);
  const previewDbUrl = requiredEnv("SUPABASE_PREVIEW_DB_URL");
  const skipUnavailablePreview = isTruthyEnv("SUPABASE_PREVIEW_SYNC_SKIP_UNAVAILABLE");

  try {
    await assertPreviewDatabaseAvailable(previewDbUrl);
    await writeGithubOutput("preview_database_available", "true");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      skipUnavailablePreview &&
      isMissingSupabasePoolerTenantErrorMessage(message)
    ) {
      console.warn(
        [
          "Skipping preview sync because the Supabase Preview database is unavailable.",
          "The pooler returned a missing tenant/user error; update SUPABASE_PREVIEW_DB_URL",
          "or recreate the Preview Supabase database before running a manual sync.",
        ].join(" "),
      );
      await writeGithubOutput("preview_database_available", "false");
      return;
    }

    throw error;
  }

  if (checkOnly) {
    console.log("Preview database connection preflight passed.");
    return;
  }

  const productionDbUrl = requiredEnv("SUPABASE_PRODUCTION_DB_URL");
  const productionUrl = requiredEnv("SUPABASE_PRODUCTION_URL");
  const productionServiceRoleKey = requiredEnv("SUPABASE_PRODUCTION_SERVICE_ROLE_KEY");
  const previewUrl = requiredEnv("SUPABASE_PREVIEW_URL");
  const previewServiceRoleKey = requiredEnv("SUPABASE_PREVIEW_SERVICE_ROLE_KEY");

  const tempDir = await mkdtemp(join(tmpdir(), "ssartnership-preview-sync-"));
  const dumpPath = join(tempDir, "production-data.sql");
  const restorePath = join(tempDir, "preview-restore.sql");

  try {
    await dumpProductionDatabase(dumpPath, productionDbUrl);
    await sanitizeDumpForPreview(dumpPath, previewDbUrl);
    await replacePreviewDatabaseData(dumpPath, restorePath, previewDbUrl);
    await seedPreviewAdminPermissions(previewDbUrl);
    await seedPreviewMemberCredentials(previewUrl, previewServiceRoleKey);
    await syncStorageBuckets(
      productionUrl,
      productionServiceRoleKey,
      previewUrl,
      previewServiceRoleKey,
    );
    console.log("Preview sync completed successfully.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function formatSyncFailure(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (!error || typeof error !== "object") {
    return String(error);
  }

  const message = typeof error.message === "string" ? error.message.trim() : "";
  const code = typeof error.code === "string" ? error.code.trim() : "";
  const hint = typeof error.hint === "string" ? error.hint.trim() : "";
  const labels = [message || "Preview sync failed", code && `[${code}]`, hint && `hint: ${hint}`]
    .filter(Boolean)
    .join(" ");
  return labels;
}

main().catch((error) => {
  console.error(formatSyncFailure(error));
  process.exit(1);
});
