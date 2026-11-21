/**
 * Deprecated runtime env aliases that are still honoured until the operator
 * confirms the live `app.env` no longer sets them. Reading one logs a single
 * warning per process with the variable name only (never its value).
 *
 * Keep this map aligned with the `legacy` tier of `scripts/lib/env-manifest.mjs`.
 */
export const DEPRECATED_ENVIRONMENT_ALIASES = {
  NAVER_SMTP_USER: "SMTP_HOST·SMTP_USER",
  NAVER_SMTP_PASS: "SMTP_PASS",
  DATA_GO_KR_SERVICE_KEY: "NTS_BUSINESS_STATUS_SERVICE_KEY",
} as const;

export type DeprecatedEnvironmentAlias =
  keyof typeof DEPRECATED_ENVIRONMENT_ALIASES;

const warnedAliases = new Set<DeprecatedEnvironmentAlias>();

export function formatDeprecatedEnvironmentAliasWarning(
  name: DeprecatedEnvironmentAlias,
) {
  return `[env] ${name}는 폐기 예정 별칭입니다. ${DEPRECATED_ENVIRONMENT_ALIASES[name]}로 옮긴 뒤 제거하세요.`;
}

/** Returns true when this call emitted the (once-per-process) warning. */
export function warnDeprecatedEnvironmentAlias(
  name: DeprecatedEnvironmentAlias,
  report: (message: string) => void = console.warn,
) {
  if (warnedAliases.has(name)) return false;
  warnedAliases.add(name);
  report(formatDeprecatedEnvironmentAliasWarning(name));
  return true;
}

export function resetDeprecatedEnvironmentAliasWarnings() {
  warnedAliases.clear();
}
