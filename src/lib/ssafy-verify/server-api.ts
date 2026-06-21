import type { SsafyVerifyServerApiConfig } from "./config";

export const SSAFY_VERIFY_SERVER_API_SCOPES = {
  profileSync: "ssafy.profile.sync",
  notifyDm: "ssafy.notify.dm",
  notifyEvent: "ssafy.notify.event",
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

export type SsafyVerifyNotificationResult = {
  notificationId: string | null;
  campaignId: string | null;
  status: string;
  requestId: string | null;
};

export type SsafyVerifyServerApiClient = ReturnType<
  typeof createSsafyVerifyServerApiClient
>;

type ClientOptions = {
  fetch?: typeof fetch;
  now?: () => number;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

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

function toRecipientPayload(input: SsafyVerifyMattermostRecipientInput) {
  const recipient: UnknownRecord = {};
  const mattermostUserId = optionalText(input.mattermostUserId, "Mattermost ID", 64);
  const username = optionalText(input.username, "Mattermost username", 64);
  const sub = optionalText(input.sub, "SSAFY subject", 200);
  const cohort = optionalText(input.cohort, "SSAFY cohort", 20);

  if (mattermostUserId) {
    recipient.mattermost_user_id = assertMattermostId(mattermostUserId);
  }
  if (username) {
    recipient.username = assertMattermostId(username, "Mattermost username");
  }
  if (sub) {
    recipient.sub = sub;
  }
  if (cohort) {
    recipient.cohort = cohort;
  }

  if (!recipient.mattermost_user_id && !recipient.username && !recipient.sub) {
    throw new Error("Mattermost 알림 수신자 식별자가 필요합니다.");
  }

  return recipient;
}

function toMessagePayload(input: SsafyVerifyMattermostMessageInput) {
  const payload: UnknownRecord = {
    title: requiredText(input.title, "알림 제목", 160),
    body: requiredText(input.body, "알림 본문", 2000),
  };
  const url = optionalText(input.url, "알림 URL", 2000);
  if (url) {
    payload.url = url;
  }
  return payload;
}

function toNotificationResult(payload: unknown): SsafyVerifyNotificationResult {
  const record = isRecord(payload) ? payload : {};
  return {
    notificationId:
      typeof record.notification_id === "string" && record.notification_id.trim()
        ? record.notification_id
        : null,
    campaignId:
      typeof record.campaign_id === "string" && record.campaign_id.trim()
        ? record.campaign_id
        : null,
    status:
      typeof record.status === "string" && record.status.trim()
        ? record.status
        : "accepted",
    requestId: safeString(record.request_id, SAFE_REQUEST_ID_PATTERN),
  };
}

export function createSsafyVerifyServerApiClient(
  config: SsafyVerifyServerApiConfig,
  options: ClientOptions = {},
) {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? (() => Date.now());
  const tokenCache = new Map<string, CachedToken>();

  async function fetchJson(
    url: string,
    init: RequestInit,
    fallback: { status: number; errorCode: string; message: string },
  ) {
    const response = await fetchImpl(url, init).then(
      (value) => value,
      () => null,
    );
    if (!response) {
      throw new SsafyVerifyServerApiError(fallback);
    }

    const json = await readJson(response);
    if (!response.ok) {
      throw normalizeErrorPayload(json.ok ? json.value : null, {
        ...fallback,
        status: response.status,
      });
    }
    if (!json.ok) {
      throw new SsafyVerifyServerApiError({
        status: 502,
        errorCode: "VERIFY_SERVER_API_INVALID_RESPONSE",
        message: "SSAFY Verify Server API 응답을 확인하지 못했습니다.",
      });
    }

    return json.value;
  }

  async function getAccessToken(scopes: readonly string[]) {
    const scope = normalizeScopeKey(scopes);
    const cached = tokenCache.get(scope);
    if (cached && cached.expiresAtMs > now()) {
      return cached.accessToken;
    }

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
    tokenCache.set(scope, {
      accessToken: payload.access_token,
      expiresAtMs: now() + Math.max(0, expiresIn * 1000 - TOKEN_REFRESH_SKEW_MS),
    });

    return payload.access_token;
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
    );
  }

  return {
    async getSsafyMemberProfile(sub: string) {
      const normalizedSub = requiredText(sub, "SSAFY subject", 200);
      return requestJson({
        method: "GET",
        path: `/ssafy-members/${encodeURIComponent(normalizedSub)}/profile`,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileSync],
      });
    },

    async getMattermostUserProfile(mattermostUserId: string) {
      const normalizedMattermostUserId = assertMattermostId(mattermostUserId);
      return requestJson({
        method: "GET",
        path: `/mattermost-users/${encodeURIComponent(normalizedMattermostUserId)}/profile`,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileSync],
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
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileSync],
      });
    },

    async syncMattermostUser(mattermostUserId: string) {
      const normalizedMattermostUserId = assertMattermostId(mattermostUserId);
      return requestJson({
        method: "POST",
        path: `/mattermost-users/${encodeURIComponent(normalizedMattermostUserId)}/sync`,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileSync],
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
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.profileSync],
      });
    },

    async sendMattermostNotification(input: SsafyVerifyMattermostNotificationInput) {
      const payload: UnknownRecord = {
        recipient: toRecipientPayload(input.recipient),
        purpose: requiredSafeKey(input.purpose, "알림 purpose"),
        template_key: requiredSafeKey(input.templateKey, "알림 template key"),
        message: toMessagePayload(input.message),
      };
      const campaignId = optionalSafeKey(input.campaignId, "campaign id");
      if (campaignId) {
        payload.campaign_id = campaignId;
      }

      return toNotificationResult(
        await requestJson({
          method: "POST",
          path: "/notifications/mattermost",
          scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyDm],
          body: payload,
          idempotencyKey: input.idempotencyKey,
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

      const payload: UnknownRecord = {
        purpose: requiredSafeKey(input.purpose, "알림 purpose"),
        template_key: requiredSafeKey(input.templateKey, "알림 template key"),
        message: toMessagePayload(input.message),
        recipients: input.recipients.map(toRecipientPayload),
      };
      const campaignId = optionalSafeKey(input.campaignId, "campaign id");
      if (campaignId) {
        payload.campaign_id = campaignId;
      }

      return toNotificationResult(
        await requestJson({
          method: "POST",
          path: "/notifications/mattermost/batch",
          scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyDm],
          body: payload,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },

    async getNotification(notificationId: string) {
      const normalizedNotificationId = requiredSafeKey(notificationId, "notification id");
      return requestJson({
        method: "GET",
        path: `/notifications/${encodeURIComponent(normalizedNotificationId)}`,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyDm],
      });
    },

    async listNotifications(input: { campaignId: string }) {
      const query = new URLSearchParams({
        campaign_id: requiredSafeKey(input.campaignId, "campaign id"),
      });
      return requestJson({
        method: "GET",
        path: "/notifications",
        query,
        scopes: [SSAFY_VERIFY_SERVER_API_SCOPES.notifyDm],
      });
    },
  };
}
