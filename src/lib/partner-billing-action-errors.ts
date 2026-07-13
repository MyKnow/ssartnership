export const PARTNER_BILLING_ACTION_ERROR_MESSAGES = {
  access_denied: "선택한 파트너사 계정에 접근할 수 없습니다.",
  profile_not_found: "증빙 프로필을 찾을 수 없습니다.",
  profile_create_failed: "증빙 프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  profile_default_failed:
    "기본 증빙 프로필을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  profile_archive_failed:
    "증빙 프로필을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export type PartnerBillingActionErrorCode =
  keyof typeof PARTNER_BILLING_ACTION_ERROR_MESSAGES;

export function getPartnerBillingActionErrorMessage(
  value: string | null | undefined,
) {
  if (value && value in PARTNER_BILLING_ACTION_ERROR_MESSAGES) {
    return PARTNER_BILLING_ACTION_ERROR_MESSAGES[
      value as PartnerBillingActionErrorCode
    ];
  }
  return value ? "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." : null;
}
