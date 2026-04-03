import {
  normalizeAdminIdentifier,
  validateAdminIdentifier,
} from "@/lib/validation";

export const ADMIN_LOGIN_ERROR_CODES = [
  "invalid_credentials",
  "rate_limited",
  "invalid_identifier",
  "invalid_request",
  "access_denied",
] as const;

export type AdminLoginErrorCode = (typeof ADMIN_LOGIN_ERROR_CODES)[number];

type SearchParamValue = string | string[] | undefined;

type AdminLoginSearchParamsInput = Record<string, SearchParamValue>;

const ADMIN_LOGIN_ERROR_CODE_SET = new Set<string>(ADMIN_LOGIN_ERROR_CODES);
const ADMIN_LOGIN_ALLOWED_QUERY_KEYS = new Set(["error", "id"]);
const ADMIN_FORM_ALLOWED_FIELDS = new Set(["id", "password"]);

export function parseAdminLoginErrorCode(
  value?: string | null,
): AdminLoginErrorCode | null {
  if (!value) {
    return null;
  }
  return ADMIN_LOGIN_ERROR_CODE_SET.has(value)
    ? (value as AdminLoginErrorCode)
    : null;
}

function getFirstQueryParamValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function sanitizeAdminLoginSearchParams(
  params: AdminLoginSearchParamsInput,
) {
  const queryKeys = Object.keys(params);
  const unexpectedKeys = queryKeys.filter(
    (key) => !ADMIN_LOGIN_ALLOWED_QUERY_KEYS.has(key),
  );

  const rawError = getFirstQueryParamValue(params.error);
  const rawId = getFirstQueryParamValue(params.id);
  const errorCode = parseAdminLoginErrorCode(rawError);
  const identifierError = rawId ? validateAdminIdentifier(rawId) : null;
  const safeIdentifier =
    rawId && !identifierError ? normalizeAdminIdentifier(rawId) : "";

  const suspiciousReasons: Array<Record<string, string | number | string[]>> = [];

  if (unexpectedKeys.length > 0) {
    suspiciousReasons.push({
      type: "unexpected_query_key",
      keys: unexpectedKeys.slice(0, 5),
      count: unexpectedKeys.length,
    });
  }

  if (Array.isArray(params.error)) {
    suspiciousReasons.push({
      type: "repeated_query_param",
      parameter: "error",
      count: params.error.length,
    });
  }

  if (Array.isArray(params.id)) {
    suspiciousReasons.push({
      type: "repeated_query_param",
      parameter: "id",
      count: params.id.length,
    });
  }

  if (rawError && !errorCode) {
    suspiciousReasons.push({
      type: "invalid_error_param",
      length: rawError.length,
    });
  }

  if (rawId && identifierError) {
    suspiciousReasons.push({
      type: "invalid_identifier_param",
      length: rawId.length,
    });
  }

  return {
    errorCode,
    defaultId: safeIdentifier,
    suspiciousReasons,
  };
}

export function inspectAdminLoginFormData(formData: FormData) {
  const fieldNames = [...new Set(Array.from(formData.keys()))];
  const unexpectedFields = fieldNames.filter(
    (field) => !ADMIN_FORM_ALLOWED_FIELDS.has(field),
  );
  const idValues = formData.getAll("id");
  const passwordValues = formData.getAll("password");

  const invalidShape =
    unexpectedFields.length > 0 ||
    idValues.length !== 1 ||
    passwordValues.length !== 1 ||
    typeof idValues[0] !== "string" ||
    typeof passwordValues[0] !== "string";

  return {
    invalidShape,
    unexpectedFields,
    id:
      typeof idValues[0] === "string"
        ? normalizeAdminIdentifier(idValues[0])
        : "",
    password: typeof passwordValues[0] === "string" ? passwordValues[0] : "",
  };
}

export function getAdminRateLimitKeys(clientIp: string, identifier?: string | null) {
  const keys = [`ip:${clientIp || "unknown"}`];
  if (identifier) {
    keys.push(`account:${identifier}`);
  }
  return keys;
}

export function isProtectedAdminPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/push/admin")
  );
}

export function getForwardedClientIp(
  headers: Pick<Headers, "get">,
): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return headers.get("x-real-ip");
}

function parseAdminAllowedIps() {
  const raw = process.env.ADMIN_ALLOWED_IPS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedAdminIp(ipAddress?: string | null) {
  const allowedIps = parseAdminAllowedIps();
  if (allowedIps.length === 0) {
    return true;
  }
  if (!ipAddress) {
    return false;
  }
  return allowedIps.includes(ipAddress);
}

function decodeBase64(value: string) {
  return atob(value);
}

export function hasValidAdminBasicAuth(authorization?: string | null) {
  const username = process.env.ADMIN_BASIC_AUTH_USERNAME;
  const password = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return true;
  }

  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = decodeBase64(authorization.slice(6));
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return false;
    }
    const providedUsername = decoded.slice(0, separatorIndex);
    const providedPassword = decoded.slice(separatorIndex + 1);
    return providedUsername === username && providedPassword === password;
  } catch {
    return false;
  }
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
