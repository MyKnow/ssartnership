import { sanitizeLogProperties, type LogJsonValue } from "./log-sanitization.ts";

/**
 * Server-side structured logging for the self-hosted runtime.
 *
 * Docker keeps container stdout/stderr in a bounded local log, so every line
 * must already be safe to retain: one JSON object, no raw error objects, no
 * provider `details`/`hint` fields, and only a redacted, bounded message.
 * Calls never throw; a logging failure must not change request behavior.
 */

export type ServerLogLevel = "error" | "warn";

export type ServerErrorSummary = {
  name?: string;
  code?: string;
  status?: number;
  digest?: string;
  message?: string;
};

const MAX_EVENT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 300;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.$]{0,63}$/u;
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/u;
const SAFE_DIGEST = /^[A-Za-z0-9_-]{1,64}$/u;

const MESSAGE_REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // Credential assignments can appear outside URLs or bearer headers.
  [/((?:api[-_]?key|authorization|client[-_]?secret|cookie|credential|password|private[-_]?key|secret|session|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,;]+)/giu, "$1[redacted]"],
  // Credentials and bearer material.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/giu, "$1 [redacted]"],
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/gu, "[token]"],
  // URLs can carry signed query strings or private object paths.
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/giu, "[url]"],
  // Contact identifiers.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, "[email]"],
  // PostgreSQL row values: `Key (column)=(value)`.
  [/\(([^()]{1,128})\)=\([^()]*\)/gu, "($1)=([value])"],
  // PostgreSQL input values: `invalid input syntax for type uuid: "value"`.
  [/(:\s*)"[^"]*"/gu, '$1"[value]"'],
  // Phone numbers, one-time codes and other long numeric identifiers.
  [/\d{6,}/gu, "[number]"],
];

function stripControlCharacters(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]+/gu, " ").trim();
}

/** Redacts values that provider error messages may echo back. */
export function redactServerErrorMessage(message: string) {
  let result = stripControlCharacters(message);
  for (const [pattern, replacement] of MESSAGE_REDACTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.length > MAX_MESSAGE_LENGTH
    ? `${result.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
    : result;
}

function readProperty(value: object, key: string): unknown {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function safeCode(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return typeof value === "string" && SAFE_CODE.test(value) ? value : undefined;
}

function safeStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

/**
 * Extracts only {name, code, status, digest, message} from an unknown thrown
 * value. Supabase/PostgREST `details` and `hint` are intentionally dropped
 * because they echo row values.
 */
export function describeServerError(error: unknown): ServerErrorSummary {
  if (error === undefined || error === null) {
    return {};
  }
  if (typeof error === "string") {
    return { message: redactServerErrorMessage(error) };
  }
  if (typeof error !== "object") {
    return { name: typeof error };
  }

  const summary: ServerErrorSummary = {};
  const name = readProperty(error, "name");
  if (typeof name === "string" && SAFE_NAME.test(name)) {
    summary.name = name;
  } else if (error instanceof Error) {
    summary.name = "Error";
  }
  const code = safeCode(readProperty(error, "code"));
  if (code) {
    summary.code = code;
  }
  const status = safeStatus(readProperty(error, "status") ?? readProperty(error, "statusCode"));
  if (status) {
    summary.status = status;
  }
  const digest = readProperty(error, "digest");
  if (typeof digest === "string" && SAFE_DIGEST.test(digest)) {
    summary.digest = digest;
  }
  const message = readProperty(error, "message");
  if (typeof message === "string" && message) {
    summary.message = redactServerErrorMessage(message);
  }
  return summary;
}

function normalizeEvent(event: string) {
  const normalized = stripControlCharacters(String(event));
  if (!normalized) {
    return "server_log";
  }
  return normalized.length > MAX_EVENT_LENGTH
    ? `${normalized.slice(0, MAX_EVENT_LENGTH - 1)}…`
    : normalized;
}

export type ServerLogEntry = {
  level: ServerLogLevel;
  event: string;
  time: string;
  error?: ServerErrorSummary;
  properties?: Record<string, LogJsonValue>;
};

/** Builds the exact JSON object that {@link logServerError} writes. */
export function buildServerLogEntry(
  level: ServerLogLevel,
  event: string,
  error?: unknown,
  properties?: Record<string, unknown> | null,
  now: Date = new Date(),
): ServerLogEntry {
  const entry: ServerLogEntry = {
    level,
    event: normalizeEvent(event),
    time: now.toISOString(),
  };
  const summary = describeServerError(error);
  if (Object.keys(summary).length > 0) {
    entry.error = summary;
  }
  const sanitized = sanitizeLogProperties(properties ?? {});
  if (Object.keys(sanitized).length > 0) {
    entry.properties = sanitized;
  }
  return entry;
}

function write(
  level: ServerLogLevel,
  event: string,
  error: unknown,
  properties: Record<string, unknown> | null | undefined,
) {
  try {
    const line = JSON.stringify(buildServerLogEntry(level, event, error, properties));
    if (level === "warn") {
      console.warn(line);
    } else {
      console.error(line);
    }
  } catch {
    try {
      console.error('{"level":"error","event":"server_log_failed"}');
    } catch {
      // Logging must never change request behavior.
    }
  }
}

/**
 * Writes one sanitized JSON line for a server-side failure.
 *
 * `event` is a fixed, non-identifying label such as
 * `"[partner-detail] favorite count fetch failed"`. Put identifiers in
 * `properties`, where the shared log sanitizer still applies.
 */
export function logServerError(
  event: string,
  error?: unknown,
  properties?: Record<string, unknown> | null,
) {
  write("error", event, error, properties);
}

/** Same contract as {@link logServerError} for recoverable conditions. */
export function logServerWarning(
  event: string,
  properties?: Record<string, unknown> | null,
  error?: unknown,
) {
  write("warn", event, error, properties);
}

/**
 * Masks the host part of an IP address for operational logs: the last IPv4
 * octet, or every IPv6 group after the /48 prefix.
 */
export function maskIpAddressForLog(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(trimmed);
  if (ipv4) {
    return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0`;
  }
  if (trimmed.includes(":") && /^[0-9A-Fa-f:.]+$/u.test(trimmed)) {
    const groups = trimmed.split("::")[0].split(":").filter(Boolean).slice(0, 3);
    return `${groups.join(":") || "0"}::`;
  }
  return "[invalid]";
}
