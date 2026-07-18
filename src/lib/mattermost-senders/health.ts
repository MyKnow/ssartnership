import type { MattermostApiErrorCode } from "@/lib/mattermost/client";
import type { MattermostSenderSafeErrorCode } from "./types";

export const MATTERMOST_SENDER_HEALTH_STATUSES = [
  "unknown",
  "healthy",
  "cooldown",
  "blocked",
] as const;

export type MattermostSenderHealthStatus =
  (typeof MATTERMOST_SENDER_HEALTH_STATUSES)[number];

export type MattermostSenderRuntimeFailureCode =
  | Extract<
      MattermostApiErrorCode,
      "unauthorized" | "forbidden" | "rate_limited" | "unavailable" | "timeout" | "invalid_response" | "request_rejected"
    >;

const RUNTIME_FAILURE_CODES = new Set<MattermostSenderRuntimeFailureCode>([
  "unauthorized",
  "forbidden",
  "rate_limited",
  "unavailable",
  "timeout",
  "invalid_response",
  "request_rejected",
]);

export function isMattermostSenderRuntimeFailureCode(
  code: MattermostSenderSafeErrorCode,
): code is MattermostSenderRuntimeFailureCode {
  return RUNTIME_FAILURE_CODES.has(code as MattermostSenderRuntimeFailureCode);
}

export function getMattermostSenderHealthFailurePolicy(
  code: MattermostSenderSafeErrorCode,
): {
  status: Exclude<MattermostSenderHealthStatus, "unknown" | "healthy">;
  blockedForSeconds: number;
} | null {
  if (code === "unauthorized" || code === "forbidden") {
    return { status: "blocked", blockedForSeconds: 60 * 60 };
  }
  if (
    code === "rate_limited"
    || code === "unavailable"
    || code === "timeout"
    || code === "invalid_response"
    || code === "request_rejected"
  ) {
    return { status: "cooldown", blockedForSeconds: 5 * 60 };
  }
  return null;
}
