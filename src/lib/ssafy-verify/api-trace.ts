import type { EventActorType } from "@/lib/event-catalog";

type UnknownRecord = Record<string, unknown>;

export type SsafyVerifyTraceSource = "server-api" | "user-auth";

export type SsafyVerifyTraceRequestSummary = Record<string, unknown>;

export type SsafyVerifyTraceResponseSummary = {
  keys: string[];
  dataKeys: string[];
  errorKeys: string[];
  profileKeys: string[];
  resultsCount: number | null;
  targetsCount: number | null;
  requestId: string | null;
  errorCode: string | null;
  status: string | null;
  campaignId: string | null;
  notificationId: string | null;
  hasAccessToken: boolean;
  hasVerificationToken: boolean;
  tokenType: string | null;
  scope: string | null;
  expiresIn: number | null;
  verificationId: string | null;
};

export type SsafyVerifyApiTraceEvent = {
  source: SsafyVerifyTraceSource;
  operation: string;
  method: string;
  path: string;
  scopes: readonly string[];
  startedAt: string;
  durationMs: number;
  status: number | null;
  ok: boolean;
  request: SsafyVerifyTraceRequestSummary;
  response: SsafyVerifyTraceResponseSummary | null;
  errorCode: string | null;
  providerRequestId: string | null;
};

export type SsafyVerifyApiTraceHandler = (
  event: SsafyVerifyApiTraceEvent,
) => void | Promise<void>;

type TraceBaseLogContext = {
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  host?: string | null;
};

type TraceLoggerInput = TraceBaseLogContext & {
  actorType?: EventActorType;
  actorId?: string | null;
  identifier?: string | null;
  properties?: Record<string, unknown> | null;
};

const SAFE_CODE_PATTERN = /^[A-Z0-9_]{1,96}$/;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;
const MAX_KEYS = 40;
const MAX_TARGET_IDENTIFIERS = 25;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeKeys(value: unknown) {
  return isRecord(value) ? Object.keys(value).sort().slice(0, MAX_KEYS) : [];
}

function readRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function readString(record: unknown, keys: readonly string[]) {
  if (!isRecord(record)) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 300);
    }
  }
  return null;
}

function readSafeCode(record: unknown, keys: readonly string[]) {
  const value = readString(record, keys);
  return value && SAFE_CODE_PATTERN.test(value) ? value : null;
}

function readSafeRequestId(record: unknown, keys: readonly string[]) {
  const value = readString(record, keys);
  return value && SAFE_REQUEST_ID_PATTERN.test(value) ? value : null;
}

function readInteger(record: unknown, key: string) {
  if (!isRecord(record)) {
    return null;
  }
  const value = record[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readLength(record: unknown, key: string) {
  if (!isRecord(record)) {
    return null;
  }
  const value = record[key];
  return Array.isArray(value) ? value.length : null;
}

function summarizeTarget(target: unknown) {
  if (!isRecord(target)) {
    return null;
  }
  return {
    sub: readString(target, ["sub"]),
    mattermostUserId: readString(target, [
      "ssafy_mattermost_user_id",
      "mattermost_user_id",
      "mattermostUserId",
    ]),
    username: readString(target, ["username"]),
    cohort: readString(target, ["cohort"]),
  };
}

function summarizeTargetIdentifiersFromTargets(targets: unknown) {
  if (!Array.isArray(targets)) {
    return [];
  }
  return targets
    .map((item) => {
      const record = isRecord(item) ? item : {};
      return summarizeTarget(record.target);
    })
    .filter((item): item is NonNullable<ReturnType<typeof summarizeTarget>> => Boolean(item))
    .slice(0, MAX_TARGET_IDENTIFIERS);
}

export function summarizeSsafyVerifyFormTraceRequest(
  body: URLSearchParams | string,
) {
  const params =
    typeof body === "string" ? new URLSearchParams(body) : body;
  return {
    contentType: "application/x-www-form-urlencoded",
    fields: Array.from(params.keys()),
    grantType: params.get("grant_type"),
    clientId: params.get("client_id"),
    hasClientSecret: params.has("client_secret"),
    hasCode: params.has("code"),
    hasCodeVerifier: params.has("code_verifier"),
    scope: params.get("scope"),
  };
}

export function summarizeSsafyVerifyJsonTraceRequest(
  body: unknown,
  query?: URLSearchParams,
) {
  if (!isRecord(body)) {
    return {
      contentType: body === undefined ? null : "application/json",
      queryKeys: query ? Array.from(query.keys()).sort() : [],
      query: query ? Object.fromEntries(query.entries()) : {},
    };
  }

  const template = readRecord(body, "template");
  const variables = readRecord(template, "variables");
  const targets = body.targets;
  return {
    contentType: "application/json",
    keys: safeKeys(body),
    queryKeys: query ? Array.from(query.keys()).sort() : [],
    query: query ? Object.fromEntries(query.entries()) : {},
    idempotencyKey: readString(body, ["idempotency_key", "idempotencyKey"]),
    campaignId: readString(body, ["campaign_id", "campaignId"]),
    purpose: readString(body, ["purpose"]),
    templateId: readString(template, ["id", "template_id", "templateId"]),
    variableKeys: safeKeys(variables),
    target: summarizeTarget(body.target),
    targetsCount: Array.isArray(targets) ? targets.length : null,
    targetIdentifiers: summarizeTargetIdentifiersFromTargets(targets),
  };
}

export function summarizeSsafyVerifyTraceResponsePayload(
  payload: unknown,
): SsafyVerifyTraceResponseSummary {
  const root = isRecord(payload) ? payload : {};
  const data = readRecord(root, "data");
  const record = data ?? root;
  const error = readRecord(root, "error") ?? readRecord(record, "error");
  const profile = readRecord(record, "profile");
  const result = readRecord(root, "result") ?? readRecord(record, "result");

  return {
    keys: safeKeys(root),
    dataKeys: safeKeys(data),
    errorKeys: safeKeys(error),
    profileKeys: safeKeys(profile),
    resultsCount: readLength(record, "results"),
    targetsCount: readLength(record, "targets"),
    requestId:
      readSafeRequestId(root, ["request_id", "requestId"]) ??
      readSafeRequestId(record, ["request_id", "requestId"]) ??
      readSafeRequestId(error, ["request_id", "requestId"]),
    errorCode:
      readSafeCode(root, ["error_code", "errorCode"]) ??
      readSafeCode(record, ["error_code", "errorCode"]) ??
      readSafeCode(error, ["code", "error_code", "errorCode"]),
    status: readString(record, ["status"]),
    campaignId: readString(record, ["campaign_id", "campaignId"]),
    notificationId: readString(record, ["notification_id", "notificationId"]),
    hasAccessToken: typeof root.access_token === "string",
    hasVerificationToken: typeof root.verification_token === "string",
    tokenType: readString(root, ["token_type", "tokenType"]),
    scope: readString(root, ["scope"]),
    expiresIn: readInteger(root, "expires_in"),
    verificationId: readString(result, ["verification_id", "verificationId"]),
  };
}

export async function emitSsafyVerifyApiTrace(
  handler: SsafyVerifyApiTraceHandler | null | undefined,
  event: SsafyVerifyApiTraceEvent,
) {
  if (!handler) {
    return;
  }
  try {
    await handler(event);
  } catch (error) {
    console.error("[ssafy-verify-api-trace] log failed", error);
  }
}

export function createSsafyVerifyApiTraceLogger(input: TraceLoggerInput = {}) {
  return async (event: SsafyVerifyApiTraceEvent) => {
    const { logAuthSecurity } = await import("@/lib/activity-logs");
    await logAuthSecurity({
      path: input.path ?? null,
      referrer: input.referrer ?? null,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      host: input.host ?? null,
      eventName: "ssafy_verify_api_trace",
      status: event.ok ? "success" : "failure",
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      identifier:
        input.identifier ??
        event.providerRequestId ??
        event.response?.requestId ??
        null,
      properties: {
        ...(input.properties ?? {}),
        source: event.source,
        operation: event.operation,
        method: event.method,
        path: event.path,
        scopes: event.scopes,
        startedAt: event.startedAt,
        durationMs: event.durationMs,
        status: event.status,
        ok: event.ok,
        request: event.request,
        response: event.response,
        errorCode: event.errorCode,
        providerRequestId: event.providerRequestId,
      },
    });
  };
}
