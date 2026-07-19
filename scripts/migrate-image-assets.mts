#!/usr/bin/env node

/**
 * Converts runtime image URL columns to internal WebP assets without deleting
 * the old object or source URL. It is intentionally dry-run by default:
 *
 *   npm run migrate:image-assets -- --dry-run
 *   npm run migrate:image-assets -- --apply --limit 200
 *
 * `--apply` updates a row only when its `updated_at` still matches the value
 * read during the scan, so an editor's in-flight change is never overwritten.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchPublicImage } from "../src/lib/image-proxy/fetch.ts";
import {
  normalizeImageBuffer,
  type ImageNormalizationPolicy,
} from "../src/lib/image-upload/transform-core.ts";

const PAGE_SIZE = 100;
const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;
const PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);

type Mode = "dry-run" | "apply";
type FieldKind = "scalar" | "array";

type ImageField = {
  column: string;
  kind: FieldKind;
  bucket: "partner-media" | "review-media" | "promotion-slides";
  policy: ImageNormalizationPolicy;
};

type TableSpec = {
  table: string;
  fields: ImageField[];
};

type MigrationOptions = {
  mode: Mode;
  limit: number;
  reportPath: string | null;
};

type ImageSource = {
  buffer: Buffer;
  contentType: string | null;
  sourceKind: "data" | "http" | "storage" | "public-file";
};

type Candidate = {
  table: string;
  rowId: string;
  updatedAt: string | null;
  field: ImageField;
  index: number;
  sourceUrl: string;
};

type CandidateReport = {
  table: string;
  rowId: string;
  column: string;
  index: number;
  sourceUrl: string;
  status: "would_convert" | "converted" | "skipped" | "failed";
  sourceKind?: ImageSource["sourceKind"];
  finalPath?: string;
  error?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this script intentionally iterates dynamic runtime tables.
type SupabaseAdminClient = SupabaseClient<any>;

const PARTNER_THUMBNAIL_POLICY: ImageNormalizationPolicy = {
  width: 1200,
  height: 1200,
  quality: 78,
  maxSourceBytes: 5 * 1024 * 1024,
  maxInputPixels: 25_000_000,
  maxOutputBytes: 5 * 1024 * 1024,
  fit: "cover",
};

const PARTNER_GALLERY_POLICY: ImageNormalizationPolicy = {
  width: 1600,
  height: 1200,
  quality: 78,
  maxSourceBytes: 5 * 1024 * 1024,
  maxInputPixels: 25_000_000,
  maxOutputBytes: 5 * 1024 * 1024,
  fit: "cover",
};

const REVIEW_POLICY: ImageNormalizationPolicy = {
  width: 900,
  height: 900,
  quality: 68,
  maxSourceBytes: 2 * 1024 * 1024,
  maxInputPixels: 25_000_000,
  maxOutputBytes: 2 * 1024 * 1024,
  fit: "cover",
};

const PROMOTION_POLICY: ImageNormalizationPolicy = {
  width: 2100,
  height: 900,
  quality: 78,
  maxSourceBytes: 10 * 1024 * 1024,
  maxInputPixels: 25_000_000,
  maxOutputBytes: 10 * 1024 * 1024,
  fit: "cover",
};

const TABLE_SPECS: TableSpec[] = [
  {
    table: "partner_brand_profiles",
    fields: [
      { column: "thumbnail_url", kind: "scalar", bucket: "partner-media", policy: PARTNER_THUMBNAIL_POLICY },
      { column: "image_urls", kind: "array", bucket: "partner-media", policy: PARTNER_GALLERY_POLICY },
    ],
  },
  {
    table: "partners",
    fields: [
      { column: "thumbnail", kind: "scalar", bucket: "partner-media", policy: PARTNER_THUMBNAIL_POLICY },
      { column: "images", kind: "array", bucket: "partner-media", policy: PARTNER_GALLERY_POLICY },
    ],
  },
  {
    table: "partner_change_requests",
    fields: [
      { column: "current_thumbnail", kind: "scalar", bucket: "partner-media", policy: PARTNER_THUMBNAIL_POLICY },
      { column: "current_images", kind: "array", bucket: "partner-media", policy: PARTNER_GALLERY_POLICY },
      { column: "requested_thumbnail", kind: "scalar", bucket: "partner-media", policy: PARTNER_THUMBNAIL_POLICY },
      { column: "requested_images", kind: "array", bucket: "partner-media", policy: PARTNER_GALLERY_POLICY },
    ],
  },
  {
    table: "partner_registration_requests",
    fields: [
      { column: "thumbnail_url", kind: "scalar", bucket: "partner-media", policy: PARTNER_THUMBNAIL_POLICY },
      { column: "image_urls", kind: "array", bucket: "partner-media", policy: PARTNER_GALLERY_POLICY },
    ],
  },
  {
    table: "partner_reviews",
    fields: [
      { column: "images", kind: "array", bucket: "review-media", policy: REVIEW_POLICY },
    ],
  },
  {
    table: "promotion_slides",
    fields: [
      { column: "image_src", kind: "scalar", bucket: "promotion-slides", policy: PROMOTION_POLICY },
    ],
  },
  {
    table: "promotion_events",
    fields: [
      { column: "hero_image_src", kind: "scalar", bucket: "promotion-slides", policy: PROMOTION_POLICY },
    ],
  },
];

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

function parsePositiveInteger(value: string | undefined, label: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return parsed;
}

function parseOptions(args: string[]): MigrationOptions {
  let mode: Mode = "dry-run";
  let limit = DEFAULT_LIMIT;
  let reportPath: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (arg === "--apply") {
      mode = "apply";
      continue;
    }
    if (arg === "--limit") {
      limit = parsePositiveInteger(args[index + 1], "--limit");
      index += 1;
      continue;
    }
    if (arg === "--report") {
      const value = args[index + 1]?.trim();
      if (!value) throw new Error("--report 경로를 확인해 주세요.");
      reportPath = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write([
        "Usage: npm run migrate:image-assets -- [--dry-run|--apply] [--limit N] [--report path]",
        "Default mode is --dry-run. Existing source URLs/objects are never deleted.",
        "\n",
      ].join("\n"));
      process.exit(0);
    }
    throw new Error(`알 수 없는 옵션입니다: ${arg}`);
  }
  return { mode, limit, reportPath };
}

function normalizeContentType(value: string | null | undefined) {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized.startsWith("image/") ? normalized : null;
}

function inferContentTypeFromPath(value: string) {
  const pathName = value.split("?", 1)[0]?.toLowerCase() ?? "";
  if (/\.jpe?g$/u.test(pathName)) return "image/jpeg";
  if (/\.png$/u.test(pathName)) return "image/png";
  if (/\.webp$/u.test(pathName)) return "image/webp";
  if (/\.avif$/u.test(pathName)) return "image/avif";
  if (/\.hei[cf]$/u.test(pathName)) return "image/heif";
  if (/\.gif$/u.test(pathName)) return "image/gif";
  if (/\.bmp$/u.test(pathName)) return "image/bmp";
  if (/\.tiff?$/u.test(pathName)) return "image/tiff";
  if (/\.svg$/u.test(pathName)) return "image/svg+xml";
  return null;
}

function parseDataImage(value: string): ImageSource | null {
  const match = value.match(/^data:(image\/[^;,]+)(;base64)?,([\s\S]*)$/iu);
  if (!match) return null;
  const contentType = normalizeContentType(match[1]);
  if (!contentType) return null;
  const payload = match[3] ?? "";
  try {
    return {
      buffer: match[2]
        ? Buffer.from(payload.replace(/\s/g, ""), "base64")
        : Buffer.from(decodeURIComponent(payload), "utf8"),
      contentType,
      sourceKind: "data",
    };
  } catch {
    throw new Error("data URL 이미지를 읽지 못했습니다.");
  }
}

function parseInternalStorageUrl(value: string, supabaseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.origin !== new URL(supabaseUrl).origin) return null;
  const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/u);
  if (!match) return null;
  return {
    bucket: decodeURIComponent(match[1] ?? ""),
    storagePath: decodeURIComponent(match[2] ?? ""),
  };
}

async function readPublicFile(value: string): Promise<ImageSource> {
  const candidate = path.resolve(PUBLIC_DIR, `.${value}`);
  const relative = path.relative(PUBLIC_DIR, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("상대 이미지 경로 범위를 확인해 주세요.");
  }
  return {
    buffer: await readFile(candidate),
    contentType: inferContentTypeFromPath(candidate),
    sourceKind: "public-file",
  };
}

async function readImageSource(input: {
  value: string;
  policy: ImageNormalizationPolicy;
  supabase: SupabaseAdminClient;
  supabaseUrl: string;
}): Promise<ImageSource> {
  const value = input.value.trim();
  const data = parseDataImage(value);
  if (data) return data;

  const internal = parseInternalStorageUrl(value, input.supabaseUrl);
  if (internal) {
    const { data: blob, error } = await input.supabase.storage
      .from(internal.bucket)
      .download(internal.storagePath);
    if (error || !blob) throw new Error("기존 Storage 이미지를 읽지 못했습니다.");
    return {
      buffer: Buffer.from(await blob.arrayBuffer()),
      contentType: normalizeContentType(blob.type) ?? inferContentTypeFromPath(internal.storagePath),
      sourceKind: "storage",
    };
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return readPublicFile(value);
  }

  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("이미지 URL 형식을 확인해 주세요.");
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error("이미지 URL은 HTTP(S)만 허용됩니다.");
  }
  const fetched = await fetchPublicImage(target, { maxBytes: input.policy.maxSourceBytes });
  return {
    buffer: fetched.body,
    contentType: normalizeContentType(fetched.contentType) ?? inferContentTypeFromPath(target.pathname),
    sourceKind: "http",
  };
}

function buildDestinationPath(candidate: Candidate, outputSha256: string) {
  const safeTable = candidate.table.replace(/[^a-z0-9_]/gi, "_");
  const safeColumn = candidate.field.column.replace(/[^a-z0-9_]/gi, "_");
  const safeRowId = candidate.rowId.replace(/[^a-z0-9-]/gi, "_");
  return `migrations/${safeTable}/${safeRowId}/${safeColumn}/${candidate.index}-${outputSha256.slice(0, 24)}.webp`;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

async function listRows(
  supabase: SupabaseAdminClient,
  spec: TableSpec,
  remaining: number,
) {
  const rows: Array<Record<string, unknown>> = [];
  const columns = ["id", "updated_at", ...spec.fields.map((field) => field.column)].join(",");
  for (let offset = 0; offset < remaining; offset += PAGE_SIZE) {
    const pageSize = Math.min(PAGE_SIZE, remaining - offset);
    const { data, error } = await supabase
      .from(spec.table)
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${spec.table} 이미지를 조회하지 못했습니다.`);
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function buildCandidates(spec: TableSpec, row: Record<string, unknown>) {
  const rowId = typeof row.id === "string" ? row.id : "";
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
  if (!rowId) return [] as Candidate[];
  return spec.fields.flatMap((field) => {
    if (field.kind === "scalar") {
      const value = row[field.column];
      const sourceUrl = typeof value === "string" ? value.trim() : "";
      return sourceUrl ? [{ table: spec.table, rowId, updatedAt, field, index: 0, sourceUrl }] : [];
    }
    return getStringArray(row[field.column]).map((sourceUrl, index) => ({
      table: spec.table,
      rowId,
      updatedAt,
      field,
      index,
      sourceUrl,
    }));
  });
}

async function writeMigrationRecord(input: {
  supabase: SupabaseAdminClient;
  candidate: Candidate;
  sourceHash?: string | null;
  finalPath?: string | null;
  finalUrl?: string | null;
  status: "converted" | "skipped" | "failed";
  errorCode?: string | null;
}) {
  const { error } = await input.supabase
    .from("image_asset_migrations")
    .upsert({
      source_url: input.candidate.sourceUrl,
      source_hash: input.sourceHash ?? null,
      target_table: input.candidate.table,
      target_column: input.candidate.field.column,
      target_row_id: input.candidate.rowId,
      target_index: input.candidate.index,
      expected_value: input.candidate.sourceUrl,
      final_bucket: input.finalPath ? input.candidate.field.bucket : null,
      final_path: input.finalPath ?? null,
      final_url: input.finalUrl ?? null,
      status: input.status,
      error_code: input.errorCode?.slice(0, 180) ?? null,
      completed_at: input.status === "converted" ? new Date().toISOString() : null,
    }, {
      onConflict: "target_table,target_column,target_row_id,target_index,expected_value",
    });
  if (error) throw new Error("이미지 이관 이력을 저장하지 못했습니다.");
}

async function migrateRow(input: {
  supabase: SupabaseAdminClient;
  supabaseUrl: string;
  spec: TableSpec;
  row: Record<string, unknown>;
  mode: Mode;
  reports: CandidateReport[];
}) {
  const candidates = buildCandidates(input.spec, input.row);
  if (candidates.length === 0) return;
  const replacements = new Map<Candidate, { value: string; sourceHash: string; finalPath: string; sourceKind: ImageSource["sourceKind"] }>();

  for (const candidate of candidates) {
    try {
      const source = await readImageSource({
        value: candidate.sourceUrl,
        policy: candidate.field.policy,
        supabase: input.supabase,
        supabaseUrl: input.supabaseUrl,
      });
      const normalized = await normalizeImageBuffer({
        source: source.buffer,
        declaredContentType: source.contentType,
        policy: candidate.field.policy,
      });
      const destinationPath = buildDestinationPath(candidate, normalized.sha256);
      const finalUrl = input.supabase.storage
        .from(candidate.field.bucket)
        .getPublicUrl(destinationPath).data.publicUrl;
      replacements.set(candidate, {
        value: finalUrl,
        sourceHash: createHash("sha256").update(source.buffer).digest("hex"),
        finalPath: destinationPath,
        sourceKind: source.sourceKind,
      });

      if (input.mode === "apply") {
        const { error } = await input.supabase.storage
          .from(candidate.field.bucket)
          .upload(destinationPath, normalized.buffer, {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: true,
          });
        if (error) throw new Error("변환된 이미지를 Storage에 저장하지 못했습니다.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "이미지 이관에 실패했습니다.";
      input.reports.push({
        table: candidate.table,
        rowId: candidate.rowId,
        column: candidate.field.column,
        index: candidate.index,
        sourceUrl: candidate.sourceUrl,
        status: "failed",
        error: message,
      });
      if (input.mode === "apply") {
        await writeMigrationRecord({
          supabase: input.supabase,
          candidate,
          status: "failed",
          errorCode: message,
        });
      }
    }
  }

  if (replacements.size === 0) return;
  const nextValues: Record<string, unknown> = {};
  for (const field of input.spec.fields) {
    const fieldCandidates = candidates.filter((candidate) => candidate.field === field);
    const replacementsForField = fieldCandidates.flatMap((candidate) => {
      const replacement = replacements.get(candidate);
      return replacement ? [{ candidate, replacement }] : [];
    });
    if (replacementsForField.length === 0) continue;
    if (field.kind === "scalar") {
      nextValues[field.column] = replacementsForField[0]?.replacement.value ?? null;
      continue;
    }
    const currentValues = getStringArray(input.row[field.column]);
    const nextValuesForField = [...currentValues];
    for (const entry of replacementsForField) {
      nextValuesForField[entry.candidate.index] = entry.replacement.value;
    }
    nextValues[field.column] = nextValuesForField;
  }

  if (input.mode === "dry-run") {
    for (const [candidate, replacement] of replacements) {
      input.reports.push({
        table: candidate.table,
        rowId: candidate.rowId,
        column: candidate.field.column,
        index: candidate.index,
        sourceUrl: candidate.sourceUrl,
        status: "would_convert",
        sourceKind: replacement.sourceKind,
        finalPath: replacement.finalPath,
      });
    }
    return;
  }

  let update = input.supabase
    .from(input.spec.table)
    .update(nextValues)
    .eq("id", candidates[0]?.rowId ?? "");
  const updatedAt = candidates[0]?.updatedAt;
  if (updatedAt) update = update.eq("updated_at", updatedAt);
  const { data, error } = await update.select("id");
  const wasUpdated = !error && Boolean(data?.[0]);
  for (const [candidate, replacement] of replacements) {
    if (!wasUpdated) {
      const message = error?.message ?? "행이 변경되어 조건부 갱신을 건너뛰었습니다.";
      await writeMigrationRecord({
        supabase: input.supabase,
        candidate,
        sourceHash: replacement.sourceHash,
        finalPath: replacement.finalPath,
        finalUrl: replacement.value,
        status: "skipped",
        errorCode: message,
      });
      input.reports.push({
        table: candidate.table,
        rowId: candidate.rowId,
        column: candidate.field.column,
        index: candidate.index,
        sourceUrl: candidate.sourceUrl,
        status: "skipped",
        sourceKind: replacement.sourceKind,
        finalPath: replacement.finalPath,
        error: message,
      });
      continue;
    }
    await writeMigrationRecord({
      supabase: input.supabase,
      candidate,
      sourceHash: replacement.sourceHash,
      finalPath: replacement.finalPath,
      finalUrl: replacement.value,
      status: "converted",
    });
    input.reports.push({
      table: candidate.table,
      rowId: candidate.rowId,
      column: candidate.field.column,
      index: candidate.index,
      sourceUrl: candidate.sourceUrl,
      status: "converted",
      sourceKind: replacement.sourceKind,
      finalPath: replacement.finalPath,
    });
  }
}

function summarize(reports: CandidateReport[]) {
  return reports.reduce<Record<string, number>>((summary, report) => ({
    ...summary,
    [report.status]: (summary[report.status] ?? 0) + 1,
  }), {});
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const reports: CandidateReport[] = [];
  let remaining = options.limit;

  for (const spec of TABLE_SPECS) {
    if (remaining <= 0) break;
    const rows = await listRows(supabase, spec, remaining);
    for (const row of rows) {
      if (remaining <= 0) break;
      await migrateRow({
        supabase,
        supabaseUrl,
        spec,
        row,
        mode: options.mode,
        reports,
      });
      remaining -= 1;
    }
  }

  const output = {
    mode: options.mode,
    limit: Number.isFinite(options.limit) ? options.limit : null,
    summary: summarize(reports),
    reports,
    note: "기존 URL과 Storage 객체는 이 스크립트에서 삭제하지 않습니다. 프로필 원장은 같은 공통 WebP 변환기를 쓰는 migrate:legacy-member-avatars 절차로 별도 이관합니다.",
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (options.reportPath) {
    await writeFile(options.reportPath, serialized, "utf8");
    process.stdout.write(`Image migration report written: ${options.reportPath}\n`);
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "이미지 이관을 시작하지 못했습니다."}\n`);
  process.exitCode = 1;
});
