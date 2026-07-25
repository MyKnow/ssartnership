const SAFE_ADMIN_MESSAGE_PATTERNS = [
  "알림 채널을 확인해 주세요.",
  "알림 템플릿 대상을 확인해 주세요.",
  "이메일 본문 형식을 확인해 주세요.",
  "테스트 수신 회원을 선택해 주세요.",
  "푸시 채널이 아직 설정되지 않았습니다.",
  "현재 조건으로 발송 가능한 대상자가 없습니다.",
  "발송 대상이 변경되었습니다.",
  "먼저 발송 대상 섹션에서 대상자 검색을 완료해 주세요.",
  "대상자 미리보기를 다시 시도해 주세요.",
  "이 브라우저에서는 푸시 알림을 사용할 수 없습니다.",
  "브라우저 알림 권한이 필요합니다.",
] as const;

export function getSafeAdminMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return SAFE_ADMIN_MESSAGE_PATTERNS.some((pattern) => message === pattern)
    ? message
    : fallback;
}

export function getSafeAdminResponseMessage(value: unknown, fallback: string) {
  return typeof value === "string" && SAFE_ADMIN_MESSAGE_PATTERNS.includes(value as (typeof SAFE_ADMIN_MESSAGE_PATTERNS)[number])
    ? value
    : fallback;
}
