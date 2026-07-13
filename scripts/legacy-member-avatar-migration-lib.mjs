const SUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SUPABASE_PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function readNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeLegacyMemberAvatarContentType(value) {
  const normalized = readNonEmptyString(value)?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized && SUPPORTED_IMAGE_CONTENT_TYPES.has(normalized)
    ? normalized
    : null;
}

export function parseLegacyMemberAvatarMigrationArgs(args) {
  let projectRef = null;
  let apply = false;
  let retainLegacy = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--retain-legacy") {
      retainLegacy = true;
      continue;
    }
    if (argument === "--project-ref") {
      const value = args[index + 1];
      if (!readNonEmptyString(value)) {
        throw new Error("--project-ref 값이 필요합니다.");
      }
      projectRef = value.trim().toLowerCase();
      index += 1;
      continue;
    }
    if (argument === "--help") {
      throw new Error("USAGE: node scripts/migrate-legacy-member-avatars.mjs --project-ref <supabase-project-ref> [--apply] [--retain-legacy]");
    }
    throw new Error(`지원하지 않는 인자입니다: ${argument}`);
  }

  if (!projectRef) {
    throw new Error("실행 대상 확인을 위해 --project-ref 값이 필요합니다.");
  }
  if (!SUPABASE_PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error("--project-ref 형식이 올바르지 않습니다.");
  }

  return { apply, projectRef, retainLegacy };
}

export function assertSupabaseProjectRef({ supabaseUrl, projectRef }) {
  const expectedRef = readNonEmptyString(projectRef)?.toLowerCase();
  if (!expectedRef || !SUPABASE_PROJECT_REF_PATTERN.test(expectedRef)) {
    throw new Error("Supabase project ref 형식이 올바르지 않습니다.");
  }

  let hostname;
  try {
    hostname = new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("SUPABASE_URL 형식이 올바르지 않습니다.");
  }

  const suffix = ".supabase.co";
  if (!hostname.endsWith(suffix)) {
    throw new Error("SUPABASE_URL은 supabase.co 프로젝트 URL이어야 합니다.");
  }
  const actualRef = hostname.slice(0, -suffix.length);
  if (actualRef !== expectedRef) {
    throw new Error("SUPABASE_URL의 project ref가 --project-ref와 일치하지 않습니다.");
  }
}

export function resolveLegacyMemberAvatarKind({ avatarBase64, avatarUrl }) {
  if (readNonEmptyString(avatarBase64)) return "base64";
  if (readNonEmptyString(avatarUrl)) return "url";
  return null;
}

function normalizeBase64Payload(value) {
  const compact = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error("기존 아바타 base64 형식이 올바르지 않습니다.");
  }
  const unpaddedLength = compact.replace(/=+$/, "").length;
  if (unpaddedLength % 4 === 1) {
    throw new Error("기존 아바타 base64 길이가 올바르지 않습니다.");
  }
  return compact.replace(/=+$/, "").padEnd(Math.ceil(unpaddedLength / 4) * 4, "=");
}

export function decodeLegacyMemberAvatarBase64({
  avatarBase64,
  avatarContentType,
}) {
  const rawValue = readNonEmptyString(avatarBase64);
  if (!rawValue) {
    throw new Error("기존 아바타 base64 값이 없습니다.");
  }

  const dataUrl = rawValue.match(/^data:([^;,]+);base64,([\s\S]*)$/i);
  const contentType = normalizeLegacyMemberAvatarContentType(
    dataUrl?.[1] ?? avatarContentType,
  );
  if (!contentType) {
    throw new Error("기존 아바타 콘텐츠 타입이 지원되지 않습니다.");
  }

  const source = Buffer.from(normalizeBase64Payload(dataUrl?.[2] ?? rawValue), "base64");
  if (source.length === 0) {
    throw new Error("기존 아바타 이미지 바이트가 비어 있습니다.");
  }

  return { contentType, source };
}

export function buildMemberProfileImageStoragePath({ memberId, sha256 }) {
  if (!UUID_PATTERN.test(memberId)) {
    throw new Error("회원 ID 형식이 올바르지 않습니다.");
  }
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error("프로필 이미지 해시 형식이 올바르지 않습니다.");
  }
  return `members/${memberId}/${sha256.toLowerCase()}.webp`;
}

export { SUPPORTED_IMAGE_CONTENT_TYPES };
