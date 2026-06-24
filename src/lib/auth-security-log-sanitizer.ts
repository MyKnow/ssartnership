const REDACTED_VALUE = "[redacted]";

const SENSITIVE_SECURITY_PROPERTY_KEYS = new Set([
  "authorization",
  "cookie",
  "errormessage",
  "message",
  "password",
  "raw",
  "rawerror",
  "request",
  "response",
  "secret",
  "stack",
  "token",
]);

function normalizePropertyKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function redactSensitiveSecurityValue(key: string, value: unknown): unknown {
  if (SENSITIVE_SECURITY_PROPERTY_KEYS.has(normalizePropertyKey(key))) {
    return REDACTED_VALUE;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuthSecurityLogValue(item));
  }
  return sanitizeAuthSecurityLogValue(value);
}

function sanitizeAuthSecurityLogValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuthSecurityLogValue(item));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      redactSensitiveSecurityValue(key, entryValue),
    ]),
  );
}

export function sanitizeAuthSecurityLogProperties(
  properties?: Record<string, unknown> | null,
) {
  if (!properties) {
    return null;
  }
  const sanitized = sanitizeAuthSecurityLogValue(properties);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : null;
}
