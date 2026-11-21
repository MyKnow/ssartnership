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

/**
 * Sender 상태(health)를 바꾸는 실패만 정책을 돌려준다. `request_rejected`
 * (400·422 등)는 특정 요청 본문·대상의 문제라 Sender를 쉬게 해도 낫지 않으므로
 * 상태를 바꾸지 않는다.
 */
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
  ) {
    return { status: "cooldown", blockedForSeconds: 5 * 60 };
  }
  return null;
}

/**
 * - `authentication`: Sender 로그인 단계. 실패는 Sender 자격·Mattermost 상태 문제다.
 * - `operation`: 로그인 뒤 회원·채널 대상 작업. 403은 대상별 권한(DM 차단,
 *   비공개 채널 등)일 수 있어 Sender 차단 근거가 되지 않는다.
 */
export type MattermostSenderFailurePhase = "authentication" | "operation";

/**
 * 런타임 작업 실패 중 Sender health에 기록할 코드만 돌려준다.
 * Sender 자체 점검은 mattermost-sender-health cron이 따로 맡는다.
 */
export function getMattermostSenderRuntimeHealthFailureCode(input: {
  code: MattermostSenderSafeErrorCode;
  phase: MattermostSenderFailurePhase;
}): MattermostSenderRuntimeFailureCode | null {
  if (!isMattermostSenderRuntimeFailureCode(input.code)) {
    return null;
  }
  if (input.code === "forbidden" && input.phase === "operation") {
    return null;
  }
  return getMattermostSenderHealthFailurePolicy(input.code) ? input.code : null;
}
