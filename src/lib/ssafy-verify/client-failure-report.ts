import type { SsafyVerifyClientFailure } from "@/lib/ssafy-verify/client-errors";

export type SsafyVerifyClientFailurePurpose =
  | "member-login"
  | "reset-password";

export type SsafyVerifyClientFailureReport = {
  purpose: SsafyVerifyClientFailurePurpose;
  errorCode: string;
  requestId: string | null;
  phase: string | null;
};

const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,96}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;
const PHASE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const REPORT_KEYS = new Set(["purpose", "errorCode", "requestId", "phase"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableSafeString(
  value: unknown,
  pattern: RegExp,
): value is string | null {
  return value === null || (typeof value === "string" && pattern.test(value));
}

export function createSsafyVerifyClientFailureReport(input: {
  purpose: SsafyVerifyClientFailurePurpose;
  failure: SsafyVerifyClientFailure;
}): SsafyVerifyClientFailureReport {
  return {
    purpose: input.purpose,
    errorCode: input.failure.errorCode,
    requestId: input.failure.requestId,
    phase: input.failure.phase ?? null,
  };
}

export function parseSsafyVerifyClientFailureReport(
  value: unknown,
): SsafyVerifyClientFailureReport | null {
  if (
    !isRecord(value)
    || Object.keys(value).some((key) => !REPORT_KEYS.has(key))
    || (value.purpose !== "member-login" && value.purpose !== "reset-password")
    || typeof value.errorCode !== "string"
    || !ERROR_CODE_PATTERN.test(value.errorCode)
    || !isNullableSafeString(value.requestId, REQUEST_ID_PATTERN)
    || !isNullableSafeString(value.phase, PHASE_PATTERN)
  ) {
    return null;
  }

  return {
    purpose: value.purpose,
    errorCode: value.errorCode,
    requestId: value.requestId,
    phase: value.phase,
  };
}
