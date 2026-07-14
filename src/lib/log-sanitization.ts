import { normalizeProductEventLocation } from "./product-event-path.ts";

export type LogJsonPrimitive = string | number | boolean | null;
export type LogJsonValue =
  | LogJsonPrimitive
  | LogJsonValue[]
  | { [key: string]: LogJsonValue };

const MAX_LOG_PROPERTY_DEPTH = 5;
const MAX_LOG_PROPERTY_ENTRIES = 40;
const MAX_LOG_ARRAY_ITEMS = 40;
const MAX_LOG_STRING_LENGTH = 512;
const MAX_LOG_PROPERTIES_BYTES = 8 * 1024;

const REDACTED_VALUE = "[redacted]";
const TRUNCATED_VALUE = "[truncated]";
const STABLE_CODE_KEYS = new Set(["reasoncode", "errorcode"]);
const sensitiveKeyPattern =
  /password|passwd|secret|token|authorization|cookie|session|credential|apikey|privatekey|clientsecret|code/i;
const locationKeyPattern = /url|uri|href|path|referrer|redirect/i;

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function shouldRedactKey(key: string) {
  const normalized = normalizeKey(key);
  return !STABLE_CODE_KEYS.has(normalized) && sensitiveKeyPattern.test(normalized);
}

function truncateString(value: string) {
  if (value.length <= MAX_LOG_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_LOG_STRING_LENGTH - 1)}…`;
}

function sanitizeLogValue(
  value: unknown,
  key: string | null,
  depth: number,
): LogJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (key && shouldRedactKey(key)) {
    return REDACTED_VALUE;
  }
  if (depth > MAX_LOG_PROPERTY_DEPTH) {
    return TRUNCATED_VALUE;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    if (key && locationKeyPattern.test(key)) {
      return normalizeProductEventLocation(value) ?? REDACTED_VALUE;
    }
    return truncateString(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof Error) {
    return "[error]";
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_LOG_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, null, depth + 1))
      .filter((item): item is LogJsonValue => item !== undefined);
    return value.length > MAX_LOG_ARRAY_ITEMS ? [...items, TRUNCATED_VALUE] : items;
  }
  if (typeof value === "object") {
    const result: Record<string, LogJsonValue> = {};
    const entries = Object.entries(value as Record<string, unknown>);

    for (const [index, [childKey, childValue]] of entries.entries()) {
      if (index >= MAX_LOG_PROPERTY_ENTRIES) {
        result._truncated = true;
        break;
      }
      const sanitizedValue = sanitizeLogValue(childValue, childKey, depth + 1);
      if (sanitizedValue !== undefined) {
        result[childKey] = sanitizedValue;
      }
    }

    return result;
  }

  return "[unsupported]";
}

function getJsonByteLength(value: LogJsonValue) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function addTruncationMarker(result: Record<string, LogJsonValue>) {
  const marked = { ...result, _truncated: true };
  return getJsonByteLength(marked) <= MAX_LOG_PROPERTIES_BYTES ? marked : result;
}

function trimToByteLimit(properties: Record<string, LogJsonValue>) {
  const result: Record<string, LogJsonValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    const candidate = { ...result, [key]: value };
    if (getJsonByteLength(candidate) > MAX_LOG_PROPERTIES_BYTES) {
      return addTruncationMarker(result);
    }
    result[key] = value;
  }

  return result;
}

/**
 * Last-line protection for every persistent log sink. Product event schemas
 * should still allowlist their fields before this function is reached.
 */
export function sanitizeLogProperties(
  properties?: Record<string, unknown> | null,
): Record<string, LogJsonValue> {
  const sanitized = sanitizeLogValue(properties ?? {}, null, 0);
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== "object") {
    return {};
  }
  return trimToByteLimit(sanitized);
}
