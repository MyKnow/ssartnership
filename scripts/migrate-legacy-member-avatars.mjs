#!/usr/bin/env node
import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { isPublicIpAddress } from "../src/lib/image-proxy/ip.ts";
import {
  SUPPORTED_IMAGE_CONTENT_TYPES,
  assertSupabaseProjectRef,
  buildMemberProfileImageStoragePath,
  decodeLegacyMemberAvatarBase64,
  normalizeLegacyMemberAvatarContentType,
  parseLegacyMemberAvatarMigrationArgs,
  resolveLegacyMemberAvatarKind,
} from "./legacy-member-avatar-migration-lib.mjs";

const MEMBER_PROFILE_IMAGES_BUCKET = "member-profile-images";
const PAGE_SIZE = 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const PROFILE_IMAGE_SIZE = 640;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

function getImageContentType(headers) {
  const rawValue = Array.isArray(headers["content-type"])
    ? headers["content-type"][0]
    : headers["content-type"];
  return normalizeLegacyMemberAvatarContentType(rawValue);
}

function getContentLength(headers) {
  const rawValue = Array.isArray(headers["content-length"])
    ? headers["content-length"][0]
    : headers["content-length"];
  const value = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

async function resolvePublicAddress(hostname) {
  if (net.isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("공개 네트워크가 아닌 아바타 URL은 가져올 수 없습니다.");
    }
    return hostname;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("아바타 URL 호스트를 확인하지 못했습니다.");
  }
  const address = addresses.find((entry) => isPublicIpAddress(entry.address))?.address;
  if (!address) {
    throw new Error("공개 네트워크가 아닌 아바타 URL은 가져올 수 없습니다.");
  }
  return address;
}

function parseLegacyAvatarUrl(value) {
  let target;
  try {
    target = new URL(value);
  } catch {
    throw new Error("기존 아바타 URL 형식이 올바르지 않습니다.");
  }
  if (
    (target.protocol !== "https:" && target.protocol !== "http:") ||
    target.username ||
    target.password ||
    target.hash ||
    (target.port &&
      !(
        (target.protocol === "https:" && target.port === "443") ||
        (target.protocol === "http:" && target.port === "80")
      ))
  ) {
    throw new Error("기존 아바타 URL은 공개 HTTP(S) URL이어야 합니다.");
  }
  return target;
}

async function fetchLegacyAvatarUrl(value) {
  const target = parseLegacyAvatarUrl(value);
  const address = await resolvePublicAddress(target.hostname);
  const client = target.protocol === "https:" ? https : http;
  const response = await new Promise((resolve, reject) => {
    const request = client.request(
      {
        protocol: target.protocol,
        hostname: address,
        port: target.port || undefined,
        method: "GET",
        path: `${target.pathname}${target.search}`,
        headers: {
          Accept: "image/jpeg,image/png,image/webp",
          "Accept-Encoding": "identity",
          Host: target.host,
        },
        servername: target.protocol === "https:" ? target.hostname : undefined,
        signal: AbortSignal.timeout(10_000),
        timeout: 10_000,
      },
      resolve,
    );
    request.once("error", reject);
    request.once("timeout", () => {
      request.destroy(new Error("기존 아바타 URL 응답 시간이 초과되었습니다."));
    });
    request.end();
  });

  const statusCode = response.statusCode ?? 0;
  if (statusCode < 200 || statusCode >= 300) {
    response.resume();
    throw new Error("기존 아바타 URL을 가져오지 못했습니다.");
  }
  const contentType = getImageContentType(response.headers);
  if (!contentType) {
    response.resume();
    throw new Error("기존 아바타 URL의 콘텐츠 타입이 지원되지 않습니다.");
  }
  const contentLength = getContentLength(response.headers);
  if (contentLength !== null && contentLength > MAX_IMAGE_BYTES) {
    response.resume();
    throw new Error("기존 아바타 URL 이미지가 5MB를 초과합니다.");
  }

  const source = await new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    response.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > MAX_IMAGE_BYTES) {
        response.destroy();
        reject(new Error("기존 아바타 URL 이미지가 5MB를 초과합니다."));
        return;
      }
      chunks.push(buffer);
    });
    response.once("end", () => resolve(Buffer.concat(chunks)));
    response.once("error", () => reject(new Error("기존 아바타 URL을 가져오지 못했습니다.")));
    response.once("aborted", () => reject(new Error("기존 아바타 URL 응답이 중단되었습니다.")));
  });

  if (source.length === 0) {
    throw new Error("기존 아바타 URL 이미지 바이트가 비어 있습니다.");
  }
  return { contentType, source };
}

function getExpectedContentType(format) {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return null;
}

async function normalizeLegacyMemberAvatar({ contentType, source }) {
  if (!SUPPORTED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error("기존 아바타 콘텐츠 타입이 지원되지 않습니다.");
  }
  if (source.length === 0 || source.length > MAX_IMAGE_BYTES) {
    throw new Error("기존 아바타 이미지 크기가 허용 범위를 벗어났습니다.");
  }

  let metadata;
  try {
    metadata = await sharp(source, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new Error("기존 아바타 이미지를 읽지 못했습니다.");
  }
  if (getExpectedContentType(metadata.format) !== contentType) {
    throw new Error("기존 아바타 이미지 형식이 콘텐츠 타입과 일치하지 않습니다.");
  }

  try {
    const buffer = await sharp(source, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .resize(PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    return {
      buffer,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  } catch {
    throw new Error("기존 아바타 이미지를 안전하게 변환하지 못했습니다.");
  }
}

async function getLegacyAvatarSource(row) {
  const kind = resolveLegacyMemberAvatarKind(row);
  if (kind === "base64") {
    return decodeLegacyMemberAvatarBase64({
      avatarBase64: row.avatar_base64,
      avatarContentType: row.avatar_content_type,
    });
  }
  if (kind === "url") {
    return fetchLegacyAvatarUrl(row.avatar_url);
  }
  throw new Error("변환할 기존 아바타 값이 없습니다.");
}

async function listLegacyAvatarRows(supabase) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("members")
      .select("id,avatar_base64,avatar_content_type,avatar_url")
      .is("deleted_at", null)
      .or("avatar_base64.not.is.null,avatar_url.not.is.null")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error("기존 아바타 회원 목록을 조회하지 못했습니다.");
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function getApprovedProfileImages(supabase, memberId) {
  const { data, error } = await supabase
    .from("member_profile_images")
    .select("id,storage_path")
    .eq("member_id", memberId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .limit(2);
  if (error) {
    throw new Error("기존 승인 프로필 사진을 조회하지 못했습니다.");
  }
  if ((data ?? []).length > 1) {
    throw new Error("회원의 승인 프로필 사진이 둘 이상입니다.");
  }
  return data?.[0] ?? null;
}

async function clearLegacyAvatar(supabase, memberId) {
  const { error } = await supabase
    .from("members")
    .update({
      avatar_base64: null,
      avatar_content_type: null,
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .is("deleted_at", null);
  if (error) {
    throw new Error("기존 아바타 컬럼을 정리하지 못했습니다.");
  }
}

async function migrateLegacyAvatarRow({ supabase, row, apply, retainLegacy }) {
  const kind = resolveLegacyMemberAvatarKind(row);
  if (!kind) {
    if (apply && !retainLegacy) await clearLegacyAvatar(supabase, row.id);
    return "empty";
  }

  const existingImage = await getApprovedProfileImages(supabase, row.id);
  if (existingImage) {
    if (apply && !retainLegacy) await clearLegacyAvatar(supabase, row.id);
    return "already_migrated";
  }

  const legacySource = await getLegacyAvatarSource(row);
  const normalized = await normalizeLegacyMemberAvatar(legacySource);
  const storagePath = buildMemberProfileImageStoragePath({
    memberId: row.id,
    sha256: normalized.sha256,
  });
  if (!apply) return "validated";

  const { error: uploadError } = await supabase.storage
    .from(MEMBER_PROFILE_IMAGES_BUCKET)
    .upload(storagePath, normalized.buffer, {
      contentType: "image/webp",
      cacheControl: "private, no-store",
      upsert: true,
    });
  if (uploadError) {
    throw new Error("정규화된 아바타를 private Storage에 저장하지 못했습니다.");
  }

  const now = new Date().toISOString();
  const { error: imageError } = await supabase
    .from("member_profile_images")
    .insert({
      member_id: row.id,
      storage_path: storagePath,
      sha256: normalized.sha256,
      content_type: "image/webp",
      width: PROFILE_IMAGE_SIZE,
      height: PROFILE_IMAGE_SIZE,
      status: "approved",
      source: "legacy",
      reviewed_at: now,
      updated_at: now,
    });
  if (imageError) {
    throw new Error("정규화된 아바타 원장을 생성하지 못했습니다.");
  }

  if (!retainLegacy) {
    await clearLegacyAvatar(supabase, row.id);
  }
  return "migrated";
}

async function assertPrivateProfileImageBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(
    MEMBER_PROFILE_IMAGES_BUCKET,
  );
  if (error || !data) {
    throw new Error("member-profile-images Storage bucket을 찾을 수 없습니다.");
  }
  if (data.public) {
    throw new Error("member-profile-images Storage bucket은 private이어야 합니다.");
  }
}

function printSummary(summary) {
  console.log(
    JSON.stringify(
      {
        projectRef: summary.projectRef,
        mode: summary.apply ? "apply" : "dry-run",
        retainLegacy: summary.retainLegacy,
        legacyRows: summary.legacyRows,
        validated: summary.validated,
        migrated: summary.migrated,
        alreadyMigrated: summary.alreadyMigrated,
        clearedWithoutImage: summary.clearedWithoutImage,
        failureCount: summary.failures.length,
        failureReasons: [...new Set(summary.failures)],
      },
      null,
      2,
    ),
  );
}

async function main() {
  const options = parseLegacyMemberAvatarMigrationArgs(process.argv.slice(2));
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  assertSupabaseProjectRef({ supabaseUrl, projectRef: options.projectRef });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  await assertPrivateProfileImageBucket(supabase);

  const rows = await listLegacyAvatarRows(supabase);
  const summary = {
    projectRef: options.projectRef,
    apply: options.apply,
    retainLegacy: options.retainLegacy,
    legacyRows: rows.length,
    validated: 0,
    migrated: 0,
    alreadyMigrated: 0,
    clearedWithoutImage: 0,
    failures: [],
  };

  for (const row of rows) {
    try {
      const result = await migrateLegacyAvatarRow({
        supabase,
        row,
        apply: options.apply,
        retainLegacy: options.retainLegacy,
      });
      if (result === "validated") summary.validated += 1;
      if (result === "migrated") summary.migrated += 1;
      if (result === "already_migrated") summary.alreadyMigrated += 1;
      if (result === "empty") summary.clearedWithoutImage += 1;
    } catch (error) {
      summary.failures.push(
        error instanceof Error ? error.message : "기존 아바타 변환에 실패했습니다.",
      );
    }
  }

  printSummary(summary);
  if (summary.failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "기존 아바타 변환을 시작하지 못했습니다.");
  process.exitCode = 1;
});
