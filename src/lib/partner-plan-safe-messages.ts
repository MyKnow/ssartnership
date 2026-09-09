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

export function getSafePartnerPlanActionMessage(
  error: unknown,
  fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
) {
  const message = error instanceof Error ? error.message : "";
  return SAFE_PARTNER_PLAN_MESSAGES.some((candidate) => candidate === message)
    ? message
    : fallback;
}
