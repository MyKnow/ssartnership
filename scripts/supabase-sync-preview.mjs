#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { sanitizeDumpSqlForPreview } from "./supabase-sync-preview-lib.mjs";

const PUBLIC_SCHEMA = "public";
const DEFAULT_CACHE_CONTROL = "31536000";
const EXCLUDED_PUBLIC_TABLES = [
  "admin_login_attempts",
  "admin_audit_logs",
  "auth_security_logs",
  "event_logs",
  "member_auth_attempts",
  "mm_verification_attempts",
  "mm_verification_codes",
  "password_reset_attempts",
  "partner_auth_attempts",
  "push_delivery_logs",
  "push_message_logs",
  "push_preferences",
  "push_subscriptions",
  "suggestion_attempts",
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function buildQualifiedName(schema, table) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function runCommand(command, args, options = {}) {
  const {
    captureStdout = false,
    captureStderr = true,
    env = {},
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [
        "ignore",
        captureStdout ? "pipe" : "inherit",
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

    if (captureStderr && child.stderr) {
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${command} failed with exit code ${code}`));
        return;
      }

      resolve({ stdout, stderr });
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
  const args = [
    "db",
    "dump",
    "--data-only",
    "--use-copy",
    "--schema",
    PUBLIC_SCHEMA,
    "--file",
    dumpPath,
    "--db-url",
    productionDbUrl,
  ];

  for (const table of EXCLUDED_PUBLIC_TABLES) {
    args.push("-x", `${PUBLIC_SCHEMA}.${table}`);
  }

  console.log("Syncing production public data dump...");
  await runCommand("supabase", args);
}

async function sanitizeDumpForPreview(dumpPath, previewDbUrl) {
  const previewColumnsByTable = await listPublicTableColumns(previewDbUrl);
  const sourceSql = await readFile(dumpPath, "utf8");
  const sanitized = sanitizeDumpSqlForPreview(sourceSql, previewColumnsByTable);

  if (!sanitized.changed) {
    return;
  }

  console.log("Sanitizing production dump for preview schema differences...");
  await writeFile(dumpPath, sanitized.sql, "utf8");
}

async function truncatePreviewDatabase(previewDbUrl) {
  const tables = await listPublicTables(previewDbUrl);
  const targetTables = tables.filter((table) => !EXCLUDED_PUBLIC_TABLES.includes(table));

  if (!targetTables.length) {
    console.log("No preview public tables to truncate.");
    return;
  }

  const truncateSql = `truncate table ${targetTables
    .map((table) => buildQualifiedName(PUBLIC_SCHEMA, table))
    .join(", ")} restart identity cascade;`;

  console.log(`Truncating ${targetTables.length} preview public tables...`);
  await runCommand(
    "psql",
    [
      "--dbname",
      previewDbUrl,
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      truncateSql,
    ],
  );
}

async function restorePreviewDatabase(dumpPath, previewDbUrl) {
  console.log("Restoring production data into preview...");
  await runCommand(
    "psql",
    [
      "--dbname",
      previewDbUrl,
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      dumpPath,
    ],
  );
}

function bucketNameFrom(bucket) {
  return bucket.id ?? bucket.name;
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
    const { data, error } = await storageClient.storage.from(bucketName).list(prefix, {
      limit,
      offset,
      sortBy: {
        column: "name",
        order: "asc",
      },
    });

    if (error) {
      throw new Error(error.message);
    }

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
    const { error } = await previewClient.storage.createBucket(bucketName, options);
    if (error) {
      throw new Error(error.message);
    }
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
  const { error } = await previewClient.storage.updateBucket(bucketName, options);
  if (error) {
    throw new Error(error.message);
  }
}

async function syncBucketPrefix(prodClient, previewClient, bucketName, prefix = "") {
  const limit = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await prodClient.storage.from(bucketName).list(prefix, {
      limit,
      offset,
      sortBy: {
        column: "name",
        order: "asc",
      },
    });

    if (error) {
      throw new Error(error.message);
    }

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

      const { data: file, error: downloadError } = await prodClient.storage
        .from(bucketName)
        .download(objectPath);

      if (downloadError) {
        throw new Error(downloadError.message);
      }
      if (!file) {
        throw new Error(`다운로드할 파일을 찾을 수 없습니다: ${bucketName}/${objectPath}`);
      }

      const contentType =
        file.type ||
        entry.metadata?.mimetype ||
        entry.metadata?.content_type ||
        "application/octet-stream";

      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await previewClient.storage
        .from(bucketName)
        .upload(objectPath, buffer, {
          contentType,
          cacheControl: DEFAULT_CACHE_CONTROL,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
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
  const extraPaths = [...previewPaths].filter((path) => !sourcePaths.has(path));

  if (extraPaths.length === 0) {
    return;
  }

  console.log(`Removing ${extraPaths.length} stale preview objects from ${bucketName}`);
  for (const batch of chunkArray(extraPaths, 100)) {
    const { error } = await previewClient.storage.from(bucketName).remove(batch);
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function syncStorageBuckets(productionUrl, productionServiceRoleKey, previewUrl, previewServiceRoleKey) {
  const prodClient = createStorageClient(productionUrl, productionServiceRoleKey);
  const previewClient = createStorageClient(previewUrl, previewServiceRoleKey);

  const { data: prodBuckets, error } = await prodClient.storage.listBuckets();
  if (error) {
    throw new Error(error.message);
  }

  const buckets = prodBuckets ?? [];
  if (buckets.length === 0) {
    console.log("No production buckets found. Skipping storage sync.");
    return;
  }

  const { data: previewBuckets, error: previewBucketsError } =
    await previewClient.storage.listBuckets();
  if (previewBucketsError) {
    throw new Error(previewBucketsError.message);
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

    await ensureBucket(previewClient, bucket, previewBucketsByName);
    console.log(`Syncing bucket: ${bucketName}`);
    await syncBucketPrefix(prodClient, previewClient, bucketName);
    await removePreviewOnlyObjects(prodClient, previewClient, bucketName);
  }
}

async function main() {
  const productionDbUrl = requiredEnv("SUPABASE_PRODUCTION_DB_URL");
  const productionUrl = requiredEnv("SUPABASE_PRODUCTION_URL");
  const productionServiceRoleKey = requiredEnv("SUPABASE_PRODUCTION_SERVICE_ROLE_KEY");
  const previewDbUrl = requiredEnv("SUPABASE_PREVIEW_DB_URL");
  const previewUrl = requiredEnv("SUPABASE_PREVIEW_URL");
  const previewServiceRoleKey = requiredEnv("SUPABASE_PREVIEW_SERVICE_ROLE_KEY");

  const tempDir = await mkdtemp(join(tmpdir(), "ssartnership-preview-sync-"));
  const dumpPath = join(tempDir, "production-data.sql");

  try {
    await dumpProductionDatabase(dumpPath, productionDbUrl);
    await sanitizeDumpForPreview(dumpPath, previewDbUrl);
    await truncatePreviewDatabase(previewDbUrl);
    await restorePreviewDatabase(dumpPath, previewDbUrl);
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
