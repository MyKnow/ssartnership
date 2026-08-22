import { NextResponse } from "next/server.js";
import {
  EmailDeliveryConfigError,
  EmailProviderError,
} from "@/lib/email-delivery";
import { SmtpConfigError } from "@/lib/smtp";

export const GRADUATE_EMAIL_DELIVERY_ERROR_CODES = [
  "smtp_missing_env",
  "smtp_incomplete_env",
  "smtp_invalid_env",
  "smtp_auth_failed",
  "smtp_connection_failed",
  "smtp_tls_failed",
  "smtp_recipient_rejected",
  "smtp_provider_rate_limited",
  "smtp_delivery_failed",
  "email_provider_invalid",
  "resend_missing_env",
  "resend_invalid_env",
  "resend_auth_failed",
  "resend_connection_failed",
  "resend_provider_rate_limited",
  "resend_recipient_rejected",
  "resend_delivery_failed",
] as const;

export type GraduateEmailDeliveryErrorCode =
  (typeof GRADUATE_EMAIL_DELIVERY_ERROR_CODES)[number];

export type GraduateEmailDeliveryDiagnostic = Readonly<{
  requestId: string | null;
  errorCode: GraduateEmailDeliveryErrorCode;
}>;

type BestEffortTask = () => unknown | Promise<unknown>;

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SMTP_CONNECTION_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNECTION",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ESOCKET",
  "ETIMEDOUT",
]);
const SMTP_TLS_ERROR_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "EPROTO",
  "ETLS",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function readErrorProperty(error: unknown, property: string) {
  if (!error || typeof error !== "object") return undefined;
  try {
    return (error as Record<string, unknown>)[property];
  } catch {
    return undefined;
  }
}

function readErrorCode(error: unknown) {
  const code = readErrorProperty(error, "code");
  return typeof code === "string" ? code.trim().toUpperCase() : null;
}

function readResponseCode(error: unknown) {
  const responseCode = readErrorProperty(error, "responseCode");
  return typeof responseCode === "number" && Number.isInteger(responseCode)
    ? responseCode
    : null;
}

function hasKnownTlsFailure(error: unknown) {
  const cause = readErrorProperty(error, "cause");
  const candidates = [
    readErrorProperty(error, "message"),
    readErrorProperty(error, "reason"),
    readErrorProperty(cause, "message"),
    readErrorProperty(cause, "reason"),
  ];

  return candidates.some(
    (value) =>
      typeof value === "string" &&
      /(?:dh key too small|certificate has expired|self[- ]signed certificate|tls|ssl|handshake|wrong version number|unsupported protocol)/i.test(
        value,
      ),
  );
}

export function classifyGraduateEmailDeliveryError(
  error: unknown,
): GraduateEmailDeliveryErrorCode {
  if (error instanceof SmtpConfigError) {
    return error.code;
  }
  if (error instanceof EmailDeliveryConfigError) {
    return error.code;
  }
  if (error instanceof EmailProviderError) {
    return error.code;
  }

  const code = readErrorCode(error);
  const responseCode = readResponseCode(error);
  if (code === "EAUTH" || [530, 534, 535].includes(responseCode ?? 0)) {
    return "smtp_auth_failed";
  }
  if ((code && SMTP_TLS_ERROR_CODES.has(code)) || hasKnownTlsFailure(error)) {
    return "smtp_tls_failed";
  }
  if (code && SMTP_CONNECTION_ERROR_CODES.has(code)) {
    return "smtp_connection_failed";
  }
  if (
    responseCode === 421 ||
    responseCode === 429 ||
    [450, 451, 452].includes(responseCode ?? 0)
  ) {
    return "smtp_provider_rate_limited";
  }
  if (
    code === "EENVELOPE" ||
    (responseCode !== null && responseCode >= 500 && responseCode < 600)
  ) {
    return "smtp_recipient_rejected";
  }
  return "smtp_delivery_failed";
}

export function getGraduateEmailDeliveryDiagnostic(
  requestId: string | null | undefined,
  error: unknown,
): GraduateEmailDeliveryDiagnostic {
  return {
    requestId:
      typeof requestId === "string" && REQUEST_ID_PATTERN.test(requestId)
        ? requestId
        : null,
    errorCode: classifyGraduateEmailDeliveryError(error),
  };
}

export function getRetryAfterHeaderValue(
  blockedUntil: string | null | undefined,
  now = Date.now(),
) {
  const blockedUntilMs = blockedUntil ? Date.parse(blockedUntil) : Number.NaN;
  const seconds = Number.isFinite(blockedUntilMs)
    ? Math.max(1, Math.ceil((blockedUntilMs - now) / 1_000))
    : 60;
  return String(seconds);
}

export function createGraduateEmailSendBlockedResponse(
  blockingState: Readonly<{
    reason: "send_quota" | "provider_failure_backoff";
    blockedUntil: string;
  }>,
  now = Date.now(),
) {
  const isProviderBackoff =
    blockingState.reason === "provider_failure_backoff";
  return NextResponse.json(
    {
      ok: false,
      message: isProviderBackoff
        ? "메일 발송 서버 연결이 원활하지 않습니다. 1분 후 다시 시도해 주세요."
        : "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    },
    {
      status: isProviderBackoff ? 503 : 429,
      headers: {
        "Retry-After": getRetryAfterHeaderValue(
          blockingState.blockedUntil,
          now,
        ),
      },
    },
  );
}

async function runBestEffort(tasks: readonly BestEffortTask[]) {
  await Promise.allSettled(
    tasks.map(async (task) => {
      await task();
    }),
  );
}

export async function runGraduateEmailDelivery(input: {
  requestId?: string | null;
  deliver: () => Promise<void>;
  afterSuccess?: readonly BestEffortTask[];
  afterFailure?: (
    diagnostic: GraduateEmailDeliveryDiagnostic,
  ) => readonly BestEffortTask[];
}): Promise<
  | { ok: true }
  | { ok: false; diagnostic: GraduateEmailDeliveryDiagnostic }
> {
  try {
    await input.deliver();
  } catch (error) {
    const diagnostic = getGraduateEmailDeliveryDiagnostic(
      input.requestId,
      error,
    );
    let failureTasks: readonly BestEffortTask[] = [];
    try {
      failureTasks = input.afterFailure?.(diagnostic) ?? [];
    } catch {
      // The delivery result is authoritative even when recovery setup fails.
    }
    await runBestEffort(failureTasks);
    return { ok: false, diagnostic };
  }

  await runBestEffort(input.afterSuccess ?? []);
  return { ok: true };
}
