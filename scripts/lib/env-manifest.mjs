/**
 * Single manifest of every environment variable the application reads.
 *
 * Tiers:
 * - `required`: self-hosted real mode refuses to start without it
 *   (`deploy/self-host/runtime-env.mjs` REAL_REQUIRED_ENV_NAMES).
 * - `build`: public `NEXT_PUBLIC_*` build argument baked into the image.
 * - `optional`: server runtime feature setting; the feature degrades safely
 *   or stays disabled when it is missing.
 * - `platform`: injected by Dockerfile/Compose/build tooling, never by hand.
 * - `compat`: still honoured for rollback compatibility but intentionally kept
 *   out of `.env.example`.
 * - `legacy`: deprecated alias kept only until the operator confirms the live
 *   runtime env no longer sets it. Never documented in example files.
 * - `development`: mock/E2E switches. Never set in a self-hosted runtime.
 *
 * `scripts/check-env.mjs` and `tests/env-manifest.test.mts` compare this list
 * with the keys read under `src/` and `next.config.ts` and with both example
 * files, so a new key must be registered here first.
 */

/** @typedef {"required" | "build" | "optional" | "platform" | "compat" | "legacy" | "development"} EnvironmentTier */

/**
 * @typedef {{
 *   name: string,
 *   tier: EnvironmentTier,
 *   secret: boolean,
 *   group: string,
 *   replacement?: string,
 *   dynamic?: boolean,
 *   note?: string,
 * }} EnvironmentVariable
 */

export const ENVIRONMENT_TIERS = Object.freeze([
  "required",
  "build",
  "optional",
  "platform",
  "compat",
  "legacy",
  "development",
]);

/** @type {ReadonlyArray<EnvironmentVariable>} */
export const ENVIRONMENT_VARIABLES = Object.freeze([
  // Supabase
  { name: "SUPABASE_URL", tier: "required", secret: false, group: "supabase" },
  { name: "SUPABASE_ANON_KEY", tier: "required", secret: true, group: "supabase" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", tier: "required", secret: true, group: "supabase" },
  { name: "SUPABASE_INTERNAL_URL", tier: "optional", secret: false, group: "supabase", note: "server SDK 전송만 내부 gateway로 보낸다" },

  { name: "SUPABASE_FETCH_TIMEOUT_MS", tier: "optional", secret: false, group: "supabase", note: "SDK 요청 제한 시간. 기본 30000ms" },
  { name: "SUPABASE_STORAGE_FETCH_TIMEOUT_MS", tier: "optional", secret: false, group: "supabase", note: "Storage 요청 제한 시간. 기본 60000ms" },

  // Sessions and HMAC secrets
  { name: "ADMIN_SESSION_SECRET", tier: "required", secret: true, group: "session" },
  { name: "USER_SESSION_SECRET", tier: "required", secret: true, group: "session" },
  { name: "PARTNER_SESSION_SECRET", tier: "required", secret: true, group: "session" },
  { name: "CERTIFICATION_QR_SECRET", tier: "required", secret: true, group: "session" },
  { name: "MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET", tier: "required", secret: true, group: "session" },
  { name: "MEMBER_EMAIL_VERIFICATION_HMAC_SECRET", tier: "required", secret: true, group: "session" },
  { name: "GRADUATE_VERIFICATION_HMAC_SECRET", tier: "required", secret: true, group: "session" },
  { name: "RESET_PASSWORD_SESSION_SECRET", tier: "optional", secret: true, group: "session", note: "미설정 시 기본 회원 세션 비밀로 대체(용도 분리 권장)" },
  { name: "MANUAL_MEMBER_IMPORT_TOKEN_SECRET", tier: "optional", secret: true, group: "session", note: "미설정 시 기본 회원 세션 비밀로 대체(용도 분리 권장)" },
  { name: "PARTNER_PREVIEW_TOKEN_ENCRYPTION_SECRET", tier: "optional", secret: true, group: "session", note: "미설정 시 ADMIN_SESSION_SECRET에서 분리 파생" },
  { name: "ADMIN_SESSION_TTL_HOURS", tier: "optional", secret: false, group: "session" },

  // Admin edge protection
  { name: "ADMIN_BASIC_AUTH_USERNAME", tier: "optional", secret: false, group: "admin" },
  { name: "ADMIN_BASIC_AUTH_PASSWORD", tier: "optional", secret: true, group: "admin" },
  { name: "ADMIN_ALLOWED_IPS", tier: "optional", secret: false, group: "admin", note: "신뢰 프록시 IP 계약이 성립한 환경에서만 설정" },

  // Mattermost sender registry
  { name: "MM_BASE_URL", tier: "required", secret: false, group: "mattermost" },
  { name: "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION", tier: "required", secret: false, group: "mattermost" },
  { name: "MM_SENDER_CREDENTIALS_KEY_V1", tier: "required", secret: true, group: "mattermost", dynamic: true, note: "활성 버전 번호로 MM_SENDER_CREDENTIALS_KEY_V<n> 이름을 계산한다" },

  // Cron and push
  { name: "CRON_SECRET", tier: "required", secret: true, group: "cron" },
  { name: "VAPID_PRIVATE_KEY", tier: "optional", secret: true, group: "push" },
  { name: "VAPID_SUBJECT", tier: "optional", secret: false, group: "push" },

  // Public build arguments
  { name: "NEXT_PUBLIC_DATA_SOURCE", tier: "build", secret: false, group: "build" },
  { name: "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE", tier: "build", secret: false, group: "build" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", tier: "build", secret: false, group: "build" },
  { name: "NEXT_PUBLIC_SITE_URL", tier: "build", secret: false, group: "build" },
  { name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", tier: "build", secret: false, group: "build" },

  // Partner billing and business status
  { name: "PARTNER_BILLING_BANK_NAME", tier: "optional", secret: false, group: "billing" },
  { name: "PARTNER_BILLING_BANK_ACCOUNT", tier: "optional", secret: true, group: "billing" },
  { name: "PARTNER_BILLING_ACCOUNT_HOLDER", tier: "optional", secret: false, group: "billing" },
  { name: "NTS_BUSINESS_STATUS_SERVICE_KEY", tier: "optional", secret: true, group: "billing" },

  // Email delivery
  { name: "EMAIL_PROVIDER", tier: "optional", secret: false, group: "email" },
  { name: "RESEND_API_KEY", tier: "optional", secret: true, group: "email" },
  { name: "EMAIL_FROM", tier: "optional", secret: false, group: "email" },
  { name: "EMAIL_REPLY_TO", tier: "optional", secret: false, group: "email" },
  { name: "SMTP_HOST", tier: "optional", secret: false, group: "email" },
  { name: "SMTP_PORT", tier: "optional", secret: false, group: "email" },
  { name: "SMTP_SECURE", tier: "optional", secret: false, group: "email" },
  { name: "SMTP_USER", tier: "optional", secret: false, group: "email" },
  { name: "SMTP_PASS", tier: "optional", secret: true, group: "email" },
  { name: "SUGGEST_NOTIFY_EMAIL", tier: "optional", secret: false, group: "email" },
  { name: "SMTP_FROM_EMAIL", tier: "compat", secret: false, group: "email", note: "SMTP 롤백 경로의 발신 주소. 미설정 시 SMTP_USER" },
  { name: "SMTP_TLS_MIN_DH_SIZE", tier: "compat", secret: false, group: "email" },
  { name: "SMTP_TLS_CIPHERS", tier: "compat", secret: false, group: "email" },

  // Apple Wallet
  { name: "APPLE_WALLET_ENABLED", tier: "optional", secret: false, group: "wallet" },
  { name: "APPLE_WALLET_TEAM_ID", tier: "optional", secret: false, group: "wallet" },
  { name: "APPLE_WALLET_PASS_TYPE_ID", tier: "optional", secret: false, group: "wallet" },
  { name: "APPLE_WALLET_ORGANIZATION_NAME", tier: "optional", secret: false, group: "wallet" },
  { name: "APPLE_WALLET_CERTIFICATE_BASE64", tier: "optional", secret: true, group: "wallet" },
  { name: "APPLE_WALLET_PRIVATE_KEY_BASE64", tier: "optional", secret: true, group: "wallet" },
  { name: "APPLE_WALLET_PRIVATE_KEY_PASSPHRASE", tier: "optional", secret: true, group: "wallet" },
  { name: "APPLE_WALLET_WWDR_CERTIFICATE_BASE64", tier: "optional", secret: true, group: "wallet" },
  { name: "APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64", tier: "optional", secret: true, group: "wallet" },

  // Self-hosted Web Vitals
  { name: "SELF_HOST_VITALS_TOKEN", tier: "optional", secret: true, group: "observability" },
  { name: "SELF_HOST_VITALS_SAMPLE_RATE", tier: "optional", secret: false, group: "observability" },

  // Injected by the platform or build tooling
  { name: "NEXT_RUNTIME", tier: "platform", secret: false, group: "platform", note: "Next.js가 nodejs/edge 런타임을 지정한다" },
  { name: "NODE_ENV", tier: "platform", secret: false, group: "platform" },
  { name: "SELF_HOST_MODE", tier: "platform", secret: false, group: "platform", note: "Compose가 real로 고정" },
  { name: "SELF_HOST_VITALS_ENABLED", tier: "platform", secret: false, group: "platform", note: "monitoring overlay가 설정" },
  { name: "SELF_HOST_BUILD", tier: "platform", secret: false, group: "platform", note: "Dockerfile 빌드 단계 전용" },
  { name: "NEXT_DIST_DIR", tier: "platform", secret: false, group: "platform", note: "E2E 빌드 출력 분리용" },

  // Deprecated aliases (deprecation warning, operator checklist before removal)
  { name: "NAVER_SMTP_USER", tier: "legacy", secret: false, group: "email", replacement: "SMTP_HOST·SMTP_USER" },
  { name: "NAVER_SMTP_PASS", tier: "legacy", secret: true, group: "email", replacement: "SMTP_PASS" },
  { name: "DATA_GO_KR_SERVICE_KEY", tier: "legacy", secret: true, group: "billing", replacement: "NTS_BUSINESS_STATUS_SERVICE_KEY" },

  // Mock and E2E switches
  { name: "MOCK_MEMBER_AUTH", tier: "development", secret: false, group: "development" },
  { name: "MOCK_ID", tier: "development", secret: false, group: "development" },
  { name: "MOCK_PW", tier: "development", secret: true, group: "development" },
  { name: "MOCK_MEMBER_PROFILE_IMAGE_URL", tier: "development", secret: false, group: "development" },
  { name: "E2E_ADMIN_AUTH", tier: "development", secret: false, group: "development" },
  { name: "E2E_MOCK_MUTATIONS", tier: "development", secret: false, group: "development" },
]);

const ACCESS_PATTERNS = Object.freeze([
  /\b(?:process\.env|env|environment)\.([A-Z][A-Z0-9_]+)\b/gu,
  /\b(?:process\.env|env|environment)\[\s*["'`]([A-Z][A-Z0-9_]+)["'`]\s*\]/gu,
  /\b[A-Z0-9_]*ENV_NAME\s*=\s*["']([A-Z][A-Z0-9_]+)["']/gu,
  /\breadEnv\(\s*["']([A-Z][A-Z0-9_]+)["']\s*\)/gu,
]);

/**
 * A registry constant named `*ENV_KEYS` or `*ENV_NAMES` (for example a map of
 * purpose to env keys that a helper reads by index) lists names the code
 * reads indirectly. Every quoted upper-case name up to the declaration's
 * terminating semicolon counts as a read.
 */
const NAME_LIST_DECLARATION = /\b[A-Z0-9_]*ENV_(?:KEYS|NAMES)\s*(?::[^=;]+)?=([^;]*)/gu;
const QUOTED_NAME = /["'`]([A-Z][A-Z0-9_]+)["'`]/gu;

/** Extracts environment variable names read by one source file. */
export function extractEnvironmentReads(source) {
  const names = new Set();
  for (const pattern of ACCESS_PATTERNS) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  for (const declaration of source.matchAll(NAME_LIST_DECLARATION)) {
    for (const match of declaration[1].matchAll(QUOTED_NAME)) names.add(match[1]);
  }
  return names;
}

/**
 * Parses `.env`-style example text. Commented `# KEY=value` lines count as
 * documented-but-optional entries.
 */
export function parseEnvironmentExample(text) {
  /** @type {Map<string, { commented: boolean }>} */
  const entries = new Map();
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*(#\s*)?([A-Z][A-Z0-9_]+)=/u.exec(line);
    if (!match) continue;
    const commented = Boolean(match[1]);
    const previous = entries.get(match[2]);
    entries.set(match[2], { commented: previous ? previous.commented && commented : commented });
  }
  return entries;
}

/**
 * Compares the manifest with source reads and both example files.
 * Returns human-readable drift messages; an empty array means no drift.
 *
 * @param {{
 *   manifest?: ReadonlyArray<EnvironmentVariable>,
 *   sourceReads: Set<string>,
 *   envExample: string,
 *   runtimeExample: string,
 *   realRequiredNames?: ReadonlyArray<string>,
 * }} input
 */
export function findEnvironmentDrift({
  manifest = ENVIRONMENT_VARIABLES,
  sourceReads,
  envExample,
  runtimeExample,
  realRequiredNames,
}) {
  const problems = [];
  const byName = new Map();
  for (const entry of manifest) {
    if (byName.has(entry.name)) problems.push(`${entry.name}: 매니페스트에 중복 등록됨`);
    if (!ENVIRONMENT_TIERS.includes(entry.tier)) problems.push(`${entry.name}: 알 수 없는 tier ${entry.tier}`);
    if (entry.name.startsWith("NEXT_PUBLIC_") !== (entry.tier === "build")) {
      problems.push(`${entry.name}: NEXT_PUBLIC_ 공개 값만 build tier에 둔다`);
    }
    if (entry.tier === "build" && entry.secret) problems.push(`${entry.name}: 공개 build 값은 비밀일 수 없다`);
    byName.set(entry.name, entry);
  }

  for (const name of [...sourceReads].sort()) {
    if (!byName.has(name)) problems.push(`${name}: 코드가 읽지만 매니페스트에 없음`);
  }
  for (const entry of manifest) {
    if (entry.dynamic || entry.tier === "legacy") continue;
    if (!sourceReads.has(entry.name)) problems.push(`${entry.name}: 매니페스트에 있지만 코드가 읽지 않음`);
  }

  const envEntries = parseEnvironmentExample(envExample);
  const runtimeEntries = parseEnvironmentExample(runtimeExample);
  for (const [file, entries] of [[".env.example", envEntries], ["deploy/self-host/runtime.env.example", runtimeEntries]]) {
    for (const name of entries.keys()) {
      const entry = byName.get(name);
      if (!entry) problems.push(`${file}: ${name}은 매니페스트에 없음`);
      else if (entry.tier === "legacy") problems.push(`${file}: 폐기 예정 별칭 ${name}을 안내하면 안 됨`);
      else if (entry.tier === "platform") problems.push(`${file}: 플랫폼 주입 값 ${name}을 직접 설정하게 안내하면 안 됨`);
    }
  }

  for (const entry of manifest) {
    const local = envEntries.get(entry.name);
    const runtime = runtimeEntries.get(entry.name);
    if (["required", "optional"].includes(entry.tier) && !local) {
      problems.push(`.env.example: ${entry.name} 누락`);
    }
    if (entry.tier === "compat" && local) {
      problems.push(`.env.example: 호환 전용 ${entry.name}은 예시에 두지 않음`);
    }
    if (entry.tier === "development" && local && !local.commented) {
      problems.push(`.env.example: 개발 전용 ${entry.name}은 주석으로만 안내`);
    }
    if (entry.tier === "required" || entry.tier === "build") {
      if (!runtime || runtime.commented) problems.push(`runtime.env.example: ${entry.tier} ${entry.name} 누락`);
    }
    if (entry.tier === "optional" && !runtime) {
      problems.push(`runtime.env.example: 선택 값 ${entry.name}을 주석으로라도 안내해야 함`);
    }
    if (entry.tier === "development" && runtime) {
      problems.push(`runtime.env.example: 개발 전용 ${entry.name}은 자체 호스팅 런타임에 두지 않음`);
    }
  }

  if (realRequiredNames) {
    const manifestRequired = manifest
      .filter((entry) => entry.tier === "required" && !entry.dynamic)
      .map((entry) => entry.name)
      .sort();
    const expected = [...realRequiredNames].sort();
    if (JSON.stringify(manifestRequired) !== JSON.stringify(expected)) {
      problems.push(`required tier가 runtime-env.mjs REAL_REQUIRED_ENV_NAMES와 다름: ${manifestRequired.join(",")} != ${expected.join(",")}`);
    }
  }

  return problems;
}
