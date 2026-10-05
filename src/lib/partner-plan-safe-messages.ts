const SAFE_PARTNER_PLAN_MESSAGES = [
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  "파트너사 접근 권한이 없습니다.",
  "제휴처 접근 권한이 없습니다.",
  "프로필 탭에서 입금자와 세금계산서 정보를 먼저 저장해 주세요.",
  "이미 처리 대기 중인 업그레이드 요청이 있습니다.",
  "제휴처를 찾을 수 없습니다.",
  "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
  "플랜 청구 정보를 확인해 주세요.",
  "플랜 업그레이드 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  "업그레이드 요청을 찾을 수 없습니다.",
  "이미 처리된 업그레이드 요청입니다.",
  "입금 확인이 완료된 청구는 취소할 수 없습니다.",
  "업그레이드 요청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.",
] as const;

export const PARTNER_PLAN_FALLBACK_ERROR_MESSAGE =
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export const PARTNER_PLAN_STATUS_MESSAGES = {
  requested: "업그레이드 요청이 접수되었습니다.",
  cancelled: "업그레이드 요청이 취소되었습니다.",
} as const;

export type PartnerPlanStatusParam = keyof typeof PARTNER_PLAN_STATUS_MESSAGES;

export function isSafePartnerPlanMessage(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SAFE_PARTNER_PLAN_MESSAGES.some((candidate) => candidate === value)
  );
}

export function getSafePartnerPlanActionMessage(
  error: unknown,
  fallback: string = PARTNER_PLAN_FALLBACK_ERROR_MESSAGE,
) {
  const message = error instanceof Error ? error.message : "";
  return isSafePartnerPlanMessage(message) ? message : fallback;
}

function readFirstParam(raw: string | string[] | null | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 플랜 화면 `?error=` 읽기 측 allowlist.
 * Next가 이미 디코딩한 값을 다시 decode하지 않고, 계약된 안내 문구만 그대로 보여 준다.
 * 그 밖의 값은 임의 문장 주입을 막기 위해 일반 안내 문구로 바꾼다.
 */
export function resolvePartnerPlanErrorParam(
  raw: string | string[] | null | undefined,
): string | null {
  const value = readFirstParam(raw);
  if (!value) {
    return null;
  }
  return isSafePartnerPlanMessage(value)
    ? value
    : PARTNER_PLAN_FALLBACK_ERROR_MESSAGE;
}

export function resolvePartnerPlanStatusParam(
  raw: string | string[] | null | undefined,
): PartnerPlanStatusParam | null {
  const value = readFirstParam(raw);
  return value === "requested" || value === "cancelled" ? value : null;
}
