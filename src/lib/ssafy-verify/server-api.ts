import type { SsafyVerifyServerApiConfig } from "./config";
import {
  emitSsafyVerifyApiTrace,
  summarizeSsafyVerifyFormTraceRequest,
  summarizeSsafyVerifyJsonTraceRequest,
  summarizeSsafyVerifyTraceResponsePayload,
  type SsafyVerifyApiTraceHandler,
  type SsafyVerifyTraceRequestSummary,
} from "./api-trace";

export const SSAFY_VERIFY_SERVER_API_SCOPES = {
  profileRead: "ssafy.profile.read",
  profileSync: "ssafy.profile.sync",
  directoryLookup: "ssafy.directory.lookup",
  notifyMattermostSend: "ssafy.notify.mattermost.send",
  notifyMattermostStatus: "ssafy.notify.mattermost.status",
} as const;

export type SsafyVerifyServerApiScope =
  (typeof SSAFY_VERIFY_SERVER_API_SCOPES)[keyof typeof SSAFY_VERIFY_SERVER_API_SCOPES];

export type SsafyVerifyMattermostRecipientInput = {
  mattermostUserId?: string | null;
  sub?: string | null;
  username?: string | null;
  cohort?: string | number | null;
};

export type SsafyVerifyMattermostMessageInput = {
  title: string;
  body: string;
  url?: string | null;
  variables?: Record<string, string | number | boolean | null | undefined>;
};

export type SsafyVerifyMattermostNotificationInput = {
  recipient: SsafyVerifyMattermostRecipientInput;
  purpose: string;
  templateKey: string;
  message: SsafyVerifyMattermostMessageInput;
  campaignId?: string | null;
  idempotencyKey?: string | null;
};

export type SsafyVerifyMattermostNotificationBatchInput = {
  recipients: readonly SsafyVerifyMattermostRecipientInput[];
  purpose: string;
  templateKey: string;
  message: SsafyVerifyMattermostMessageInput;
  campaignId?: string | null;
  idempotencyKey?: string | null;
};

export type SsafyVerifyNotificationSummary = {
  total: number;
  queued: number;
  sent: number;
  retrying: number;
  failed: number;
  skipped: number;
};

export type SsafyVerifyNotificationTargetResult = {
  idempotencyKey: string | null;
  notificationId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  requestId: string | null;
};

export type SsafyVerifyNotificationResult = {
  notificationId: string | null;
  campaignId: string | null;
  status: string;
  requestId: string | null;
  summary: SsafyVerifyNotificationSummary | null;
  results: readonly SsafyVerifyNotificationTargetResult[];
};

export type SsafyVerifyServerApiClient = ReturnType<
  typeof createSsafyVerifyServerApiClient
>;

type ClientOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  trace?: SsafyVerifyApiTraceHandler | null;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};
type InFlightToken = Promise<CachedToken>;

type UnknownRecord = Record<string, unknown>;

const MATTERMOST_ID_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const SAFE_CODE_PATTERN = /^[A-Z0-9_]{1,96}$/;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;
const SAFE_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const TOKEN_REFRESH_SKEW_MS = 30_000;
const DEFAULT_TOKEN_TTL_SECONDS = 600;
const MAX_BATCH_RECIPIENTS = 25;
const UNSAFE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export class SsafyVerifyServerApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly requestId: string | null;

  constructor(input: {
    status: number;
    errorCode: string;
    message: string;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = "SsafyVerifyServerApiError";
    this.status = input.status;
    this.errorCode = input.errorCode;
    this.requestId = input.requestId ?? null;
  }

  toJSON() {
    return {
      status: this.status,
      errorCode: this.errorCode,
      message: this.message,
      requestId: this.requestId,
    };
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(
  value: unknown,
  pattern: RegExp,
): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function safePublicMessage(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300 || UNSAFE_TEXT_CONTROL_PATTERN.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function normalizeErrorPayload(
  payload: unknown,
  fallback: { status: number; errorCode: string; message: string },
) {
  const root = isRecord(payload) ? payload : {};
  const nested = isRecord(root.error) ? root.error : {};
  const errorCode =
    safeString(root.error_code, SAFE_CODE_PATTERN) ??
    safeString(nested.code, SAFE_CODE_PATTERN) ??
    fallback.errorCode;
  const message = safePublicMessage(root.message ?? nested.message, fallback.message);
  const requestId =
    safeString(root.request_id, SAFE_REQUEST_ID_PATTERN) ??
    safeString(nested.request_id, SAFE_REQUEST_ID_PATTERN);

  return new SsafyVerifyServerApiError({
    status: fallback.status,
    errorCode,
    message,
    requestId,
  });
}

async function readJson(response: Response) {
  return response.json().then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function withQuery(url: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

function normalizeScopeKey(scopes: readonly string[]) {
  return Array.from(
    new Set(scopes.map((scope) => scope.trim()).filter(Boolean)),
  )
    .sort()
    .join(" ");
}

function requiredSafeKey(value: string, label: string) {
  const normalized = value.trim();
  if (!SAFE_KEY_PATTERN.test(normalized)) {
    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }
  return normalized;
}

function optionalSafeKey(value: string | null | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return requiredSafeKey(normalized, label);
}

function requiredText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || UNSAFE_TEXT_CONTROL_PATTERN.test(normalized)) {
    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }
  return normalized;
}

function optionalText(value: string | number | null | undefined, label: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength || UNSAFE_TEXT_CONTROL_PATTERN.test(normalized)) {
    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }
  return normalized;
}

function readString(record: UnknownRecord, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readInteger(record: UnknownRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function isValidMattermostId(value: string) {
  return MATTERMOST_ID_PATTERN.test(value.trim());
}

export function assertMattermostId(value: string, label = "Mattermost ID") {
  const normalized = value.trim();
  if (!MATTERMOST_ID_PATTERN.test(normalized)) {
    throw new Error(`${label}는 3~64자의 영문, 숫자, ., _, -만 사용할 수 있습니다.`);
  }
  return normalized;
}

function toNotificationTargetPayload(input: SsafyVerifyMattermostRecipientInput) {
  const target: UnknownRecord = {};
  const mattermostUserId = optionalText(input.mattermostUserId, "Mattermost ID", 64);
  const sub = optionalText(input.sub, "SSAFY subject", 200);
  const username = optionalText(input.username, "Mattermost username", 64);
  const cohort = optionalText(input.cohort, "SSAFY cohort", 20);

  if (mattermostUserId) {
    target.ssafy_mattermost_user_id = assertMattermostId(mattermostUserId);
  }
  if (sub) {
    target.sub = sub;
  }

  if (target.ssafy_mattermost_user_id && target.sub) {
    throw new Error("Mattermost 알림 수신자는 Mattermost user id와 SSAFY subject를 동시에 사용할 수 없습니다.");
  }
  if (username || cohort) {
    throw new Error("Mattermost 알림은 Mattermost user id 또는 SSAFY subject 기준으로만 발송할 수 있습니다.");
  }

  if (!target.ssafy_mattermost_user_id && !target.sub) {
    throw new Error("Mattermost 알림 수신자 식별자가 필요합니다.");
  }

  return target;
}

function toTemplatePayload(input: {
  templateKey: string;
  message: SsafyVerifyMattermostMessageInput;
}) {
  const variables: UnknownRecord = {
    title: requiredText(input.message.title, "알림 제목", 160),
    body: requiredText(input.message.body, "알림 본문", 2000),
  };
  const url = optionalText(input.message.url, "알림 URL", 2000);
  if (url) {
    variables.url = url;
  }
  for (const [rawKey, rawValue] of Object.entries(input.message.variables ?? {})) {
    const key = requiredSafeKey(rawKey, "알림 변수 key");
    if (key === "title" || key === "body" || key === "url") {
      continue;
    }
    const value = optionalText(
      typeof rawValue === "boolean" ? String(rawValue) : rawValue,
      `알림 변수 ${key}`,
      2000,
    );
    if (value !== null) {
      variables[key] = value;
    }
  }

  return {
    id: requiredSafeKey(input.templateKey, "알림 template key"),
    variables,
  };
}

function readNotificationSummary(payload: unknown): SsafyVerifyNotificationSummary | null {
  if (!isRecord(payload)) {
    return null;
  }
  const total = readInteger(payload, "total");
  if (total === null) {
    return null;
  }
  return {
    total,
    queued: readInteger(payload, "queued") ?? 0,
    sent: readInteger(payload, "sent") ?? 0,
    retrying: readInteger(payload, "retrying") ?? 0,
    failed: readInteger(payload, "failed") ?? 0,
    skipped: readInteger(payload, "skipped") ?? 0,
  };
}

function readNotificationTargetResults(payload: unknown): SsafyVerifyNotificationTargetResult[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item) => {
    const record = isRecord(item) ? item : {};
    const error = isRecord(record.error) ? record.error : {};
    const errorMessage =
      typeof error.message === "string"
        ? safePublicMessage(error.message, "") || null
        : null;

    return {
      idempotencyKey: readString(record, ["idempotency_key", "idempotencyKey"]),
      notificationId: readString(record, ["notification_id", "notificationId"]),
      status: readString(record, ["status"]) ?? "accepted",
      errorCode:
        safeString(error.code, SAFE_CODE_PATTERN) ??
        safeString(record.error_code, SAFE_CODE_PATTERN),
      errorMessage,
      requestId:
        safeString(error.request_id, SAFE_REQUEST_ID_PATTERN) ??
        safeString(record.request_id, SAFE_REQUEST_ID_PATTERN),
    };
  });
}

function deriveNotificationStatus(
  summary: SsafyVerifyNotificationSummary | null,
  results: readonly SsafyVerifyNotificationTargetResult[],
) {
  if (results.length === 1) {
    return results[0]?.status ?? "accepted";
  }
  if (!summary || summary.total <= 0) {
    return "accepted";
  }
  if (summary.failed >= summary.total) {
    return "failed";
  }
  if (summary.sent >= summary.total) {
    return "sent";
  }
  if (summary.retrying > 0) {
    return "retrying";
  }
  if (summary.queued > 0) {
    return "queued";
  }
  if (summary.skipped >= summary.total) {
    return "skipped";
  }
  return summary.failed > 0 ? "retrying" : "accepted";
}

function toNotificationResult(payload: unknown): SsafyVerifyNotificationResult {
  const root = isRecord(payload) ? payload : {};
  const record = isRecord(root.data) ? root.data : root;
  const results = readNotificationTargetResults(record.results);
  const summary = readNotificationSummary(record.summary);
  const status = readString(record, ["status"]) ?? deriveNotificationStatus(summary, results);
  return {
    notificationId:
      readString(record, ["notification_id", "notificationId"]) ??
      (results.length === 1 ? results[0]?.notificationId ?? null : null),
    campaignId: readString(record, ["campaign_id", "campaignId"]),
    status,
    requestId:
      safeString(record.request_id, SAFE_REQUEST_ID_PATTERN) ??
      safeString(root.request_id, SAFE_REQUEST_ID_PATTERN),
    summary,
    results,
  };
}

export function createSsafyVerifyServerApiClient(
  config: SsafyVerifyServerApiConfig,
  options: ClientOptions = {},
) {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? (() => Date.now());
  const trace = options.trace ?? null;
  const tokenCache = new Map<string, CachedToken>();
  const inFlightToken = new Map<string, InFlightToken>();

  async function fetchJson(
    url: string,
    init: RequestInit,
    fallback: { status: number; errorCode: string; message: string },
    traceInput: {
      operation: string;
      method: "GET" | "POST";
      path: string;
      scopes: readonly string[];
      request: SsafyVerifyTraceRequestSummary;
    },
  ) {
    const startedAtMs = now();
    const response = await fetchImpl(url, init).then(
      (value) => value,
      () => null,
    );
    if (!response) {
      await emitSsafyVerifyApiTrace(trace, {
        source: "server-api",
        operation: traceInput.operation,
        method: traceInput.method,
        path: traceInput.path,
        scopes: traceInput.scopes,
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: Math.max(0, now() - startedAtMs),
        status: null,
        ok: false,
        request: traceInput.request,
        response: null,
        errorCode: fallback.errorCode,
        providerRequestId: null,
      });
      throw new SsafyVerifyServerApiError(fallback);
    }

    const json = await readJson(response);
    const responseSummary = json.ok
      ? summarizeSsafyVerifyTraceResponsePayload(json.value)
      : null;
    if (!response.ok) {
      const normalizedError = normalizeErrorPayload(json.ok ? json.value : null, {
        ...fallback,
        status: response.status,
      });
      await emitSsafyVerifyApiTrace(trace, {
        source: "server-api",
        operation: traceInput.operation,
        method: traceInput.method,
        path: traceInput.path,
        scopes: traceInput.scopes,
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: Math.max(0, now() - startedAtMs),
        status: response.status,
        ok: false,
        request: traceInput.request,
        response: responseSummary,
        errorCode: normalizedError.errorCode,
        providerRequestId: normalizedError.requestId,
      });
      throw normalizedError;
    }
    if (!json.ok) {
      await emitSsafyVerifyApiTrace(trace, {
        source: "server-api",
        operation: traceInput.operation,
        method: traceInput.method,
        path: traceInput.path,
        scopes: traceInput.scopes,
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: Math.max(0, now() - startedAtMs),
        status: response.status,
        ok: false,
        request: traceInput.request,
        response: null,
        errorCode: "VERIFY_SERVER_API_INVALID_RESPONSE",
        providerRequestId: null,
      });
      throw new SsafyVerifyServerApiError({
        status: 502,
        errorCode: "VERIFY_SERVER_API_INVALID_RESPONSE",
        message: "SSAFY Verify Server API 응답을 확인하지 못했습니다.",
      });
    }

    await emitSsafyVerifyApiTrace(trace, {
      source: "server-api",
      operation: traceInput.operation,
      method: traceInput.method,
      path: traceInput.path,
      scopes: traceInput.scopes,
      startedAt: new Date(startedAtMs).toISOString(),
      durationMs: Math.max(0, now() - startedAtMs),
      status: response.status,
      ok: true,
      request: traceInput.request,
      response: responseSummary,
      errorCode: null,
      providerRequestId: responseSummary?.requestId ?? null,
    });

    return json.value;
  }

  async function getAccessToken(scopes: readonly string[]) {
    const scope = normalizeScopeKey(scopes);
    const cached = tokenCache.get(scope);
    if (cached && cached.expiresAtMs > now()) {
      return cached.accessToken;
    }

    const inFlight = inFlightToken.get(scope);
    if (inFlight) {
      return (await inFlight).accessToken;
    }

    const nextTokenRequest: InFlightToken = (async () => {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });
      if (scope) {
        body.set("scope", scope);
      }

      const payload = await fetchJson(
        joinUrl(config.apiBaseUrl, "/server/token"),
        {
          method: "POST",
          headers: {
            "cache-control": "no-store",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
          cache: "no-store",
        },
        {
          status: 502,
          errorCode: "VERIFY_SERVER_TOKEN_FAILED",
          message: "SSAFY Verify Server API 토큰 발급에 실패했습니다.",
        },
        {
          operation: "client_credentials_token",
          method: "POST",
          path: "/server/token",
          scopes: scope ? scope.split(" ") : [],
          request: summarizeSsafyVerifyFormTraceRequest(body),
        },
      );

      if (!isRecord(payload) || typeof payload.access_token !== "string") {
        throw new SsafyVerifyServerApiError({
          status: 502,
          errorCode: "VERIFY_SERVER_TOKEN_INVALID",
          message: "SSAFY Verify Server API 토큰 응답을 확인하지 못했습니다.",
        });
      }
      if (
        typeof payload.token_type === "string" &&
        payload.token_type.toLowerCase() !== "bearer"
      ) {
        throw new SsafyVerifyServerApiError({
          status: 502,
          errorCode: "VERIFY_SERVER_TOKEN_INVALID",
          message: "SSAFY Verify Server API 토큰 응답을 확인하지 못했습니다.",
        });
      }

      const expiresIn =
        typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
          ? payload.expires_in
          : DEFAULT_TOKEN_TTL_SECONDS;
      const cachedToken = {
        accessToken: payload.access_token,
        expiresAtMs: now() + Math.max(0, expiresIn * 1000 - TOKEN_REFRESH_SKEW_MS),
      };
      tokenCache.set(scope, cachedToken);
      return cachedToken;
    })();
    inFlightToken.set(scope, nextTokenRequest);

    try {
      return (await nextTokenRequest).accessToken;
    } finally {
      inFlightToken.delete(scope);
    }
  }

  async function requestJson(input: {
    method: "GET" | "POST";
    path: string;
    scopes: readonly string[];
    body?: unknown;
    query?: URLSearchParams;
    idempotencyKey?: string | null;
  }) {
    const accessToken = await getAccessToken(input.scopes);
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    };
    if (input.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const idempotencyKey = optionalSafeKey(input.idempotencyKey, "idempotency key");
    if (idempotencyKey) {
      headers["idempotency-key"] = idempotencyKey;
    }

    return fetchJson(
      withQuery(joinUrl(config.apiBaseUrl, input.path), input.query ?? new URLSearchParams()),
      {
        method: input.method,
        headers,
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        cache: "no-store",
      },
      {
        status: 502,
        errorCode: "VERIFY_SERVER_API_FAILED",
        message: "SSAFY Verify Server API 요청에 실패했습니다.",
      },
      {
        operation: "server_api_request",
        method: input.method,
        path: input.path,
        scopes: input.scopes,
        request: summarizeSsafyVerifyJsonTraceRequest(
          input.body,
          input.query,
        ),
      },
    );
  }

  return {
    async getSsafyMemberProfile(sub: string) {
      const normalizedSub = requiredText(sub, "SSAFY subject", 200);
      return requestJson({
        method: "GET",
        path: `/ssafy-members/${encodeURIComponent(normalizedSub)}/profile`,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileRead],
      });
    },

    async getMattermostUserProfile(mattermostUserId: string) {
      const normalizedMattermostUserId = assertMattermostId(mattermostUserId);
      return requestJson({
        method: "GET",
        path: `/mattermost-users/${encodeURIComponent(normalizedMattermostUserId)}/profile`,
        scopes: [
          SSAFY_VERIFY_SERVER_API_SCOPES.profileRead,
          SSAFY_VERIFY_SERVER_API_SCOPES.directoryLookup,
        ],
      });
    },

    async findMattermostUsers(input: { username: string; cohort?: string | number | null }) {
      const query = new URLSearchParams({
        username: assertMattermostId(input.username, "Mattermost username"),
      });
      const cohort = optionalText(input.cohort, "SSAFY cohort", 20);
      if (cohort) {
        query.set("cohort", cohort);
      }
      return requestJson({
        method: "GET",
        path: "/mattermost-users",
        query,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.directoryLookup],
      });
    },

    async syncMattermostUser(mattermostUserId: string) {
      const normalizedMattermostUserId = assertMattermostId(mattermostUserId);
      return requestJson({
        method: "POST",
        path: `/mattermost-users/${encodeURIComponent(normalizedMattermostUserId)}/sync`,
        scopes: [
          SSAFY_VERIFY_SERVER_API_SCOPES.profileSync,
          SSAFY_VERIFY_SERVER_API_SCOPES.directoryLookup,
        ],
      });
    },

    async getProfileEvents(input: { cursor?: string | null; limit?: number | null } = {}) {
      const query = new URLSearchParams();
      const cursor = optionalText(input.cursor, "profile event cursor", 300);
      if (cursor) {
        query.set("cursor", cursor);
      }
      if (typeof input.limit === "number") {
        const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 100);
        query.set("limit", String(limit));
      }
      return requestJson({
        method: "GET",
        path: "/profile-events",
        query,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileRead],
      });
    },

    async sendMattermostNotification(input: SsafyVerifyMattermostNotificationInput) {
      const idempotencyKey = optionalSafeKey(input.idempotencyKey, "idempotency key");
      if (!idempotencyKey) {
        throw new Error("Mattermost 알림 idempotency key가 필요합니다.");
      }
      const payload: UnknownRecord = {
        idempotency_key: idempotencyKey,
        campaign_id:
          optionalSafeKey(input.campaignId, "campaign id") ?? idempotencyKey,
        purpose: requiredSafeKey(input.purpose, "알림 purpose"),
        target: toNotificationTargetPayload(input.recipient),
        template: toTemplatePayload({
          templateKey: input.templateKey,
          message: input.message,
        }),
      };

      return toNotificationResult(
        await requestJson({
          method: "POST",
          path: "/notifications/mattermost",
          scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyMattermostSend],
          body: payload,
        }),
      );
    },

    async sendMattermostNotificationBatch(
      input: SsafyVerifyMattermostNotificationBatchInput,
    ) {
      if (input.recipients.length === 0) {
        throw new Error("Mattermost batch 알림 수신자가 필요합니다.");
      }
      if (input.recipients.length > MAX_BATCH_RECIPIENTS) {
        throw new Error("Mattermost batch 알림은 최대 25명까지 발송할 수 있습니다.");
      }
      const campaignId = optionalSafeKey(input.campaignId, "campaign id");
      if (!campaignId) {
        throw new Error("Mattermost batch 알림 campaign id가 필요합니다.");
      }
      const idempotencyPrefix = optionalSafeKey(input.idempotencyKey, "idempotency key") ?? campaignId;

      const payload: UnknownRecord = {
        campaign_id: campaignId,
        purpose: requiredSafeKey(input.purpose, "알림 purpose"),
        template: toTemplatePayload({
          templateKey: input.templateKey,
          message: input.message,
        }),
        targets: input.recipients.map((recipient, index) => ({
          idempotency_key: requiredSafeKey(
            `${idempotencyPrefix}:${index + 1}`,
            "idempotency key",
          ),
          target: toNotificationTargetPayload(recipient),
        })),
      };

      return toNotificationResult(
        await requestJson({
          method: "POST",
          path: "/notifications/mattermost/batch",
          scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyMattermostSend],
          body: payload,
        }),
      );
    },

    async getNotification(notificationId: string) {
      const normalizedNotificationId = requiredSafeKey(notificationId, "notification id");
      return toNotificationResult(
        await requestJson({
          method: "GET",
          path: `/notifications/${encodeURIComponent(normalizedNotificationId)}`,
          scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyMattermostStatus],
        }),
      );
    },

    async listNotifications(input: { campaignId: string }) {
      const query = new URLSearchParams({
        campaign_id: requiredSafeKey(input.campaignId, "campaign id"),
      });
      return toNotificationResult(
        await requestJson({
          method: "GET",
          path: "/notifications",
          query,
          scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyMattermostStatus],
        }),
      );
    },
  };
}
