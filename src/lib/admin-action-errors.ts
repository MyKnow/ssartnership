import type { AdminReviewQueueErrorCode } from "@/lib/admin-review-queue";
import type { NotificationTemplateErrorCode } from "@/lib/notification-templates/admin-feedback";
import type { PartnerFormErrorCode } from "@/lib/partner-form-errors";
import { isAllowedKey, pickAllowedEntry } from "@/lib/safe-messages";

/**
 * 관리자 server action이 `?error=<code>`로 넘기는 공용 오류 코드와 안내 문구.
 * 키가 곧 코드 타입(AdminActionErrorCode)이므로 존재하지 않는 코드를 redirect하면 타입 검사에서 실패한다.
 * 화면 전용 코드는 그 화면의 메시지 맵(검토 큐, 알림 템플릿 등)이 소유하고
 * `AdminRedirectErrorCode`(shared-helpers)에서 함께 허용한다.
 */
export const adminActionErrorMessages = {
  category_missing_fields: "카테고리 키와 라벨을 입력해 주세요.",
  category_invalid_key: "카테고리 키 형식을 확인해 주세요.",
  category_invalid_color: "카테고리 색상은 #RRGGBB 형식이어야 합니다.",
  category_invalid_request: "카테고리 입력값을 확인해 주세요.",
  category_delete_deferred:
    "데이터 보호를 위해 카테고리 삭제는 현재 잠겨 있습니다. 이름과 설명은 수정할 수 있습니다.",
  company_missing_name: "파트너사명을 입력해 주세요.",
  company_invalid_email: "담당자 이메일 형식이 올바르지 않습니다.",
  company_invalid_request: "파트너사 입력값을 확인해 주세요.",
  company_has_billing_records:
    "청구·결제 기록이 있는 파트너사는 삭제할 수 없습니다. 운영을 멈추려면 비활성화해 주세요.",
  partner_update_failed: "제휴처를 저장하지 못했습니다. 입력값과 권한을 확인한 뒤 다시 시도해 주세요.",
  cycle_missing_fields: "기준 기수, 기준 연도, 기준 월을 모두 입력해 주세요.",
  cycle_invalid_number: "기준값은 허용된 범위의 숫자로 입력해 주세요.",
  cycle_invalid_request: "기수 기준 입력값을 확인해 주세요.",
  cohort_theme_missing_fields: "기수와 카드 색상을 모두 입력해 주세요.",
  cohort_theme_invalid_year: "카드 색상 기수는 1~99 사이의 숫자로 입력해 주세요.",
  cohort_theme_invalid_color: "카드 색상은 #RRGGBB 형식으로 입력해 주세요.",
  cohort_theme_invalid_request: "기수별 카드 색상 입력값을 확인해 주세요.",
  mattermost_sender_invalid_request: "Mattermost Sender 입력값을 확인해 주세요.",
  mattermost_sender_configuration_failed: "Mattermost Sender 서버 설정을 확인해 주세요.",
  mattermost_sender_candidate_missing: "Mattermost Sender 후보를 찾을 수 없거나 이미 만료되었습니다.",
  mattermost_sender_test_target_unavailable: "테스트 수신자를 찾을 수 없습니다. 이전 기수 Sender 또는 현재 Super Admin의 MM 연결을 확인해 주세요.",
  mattermost_sender_test_rate_limited: "Sender 테스트 횟수가 제한되었습니다. 30분 후 다시 시도해 주세요.",
  mattermost_sender_test_failed: "Mattermost Sender 테스트에 실패했습니다. 로그인 정보와 Mattermost 상태를 확인해 주세요.",
  mattermost_sender_disable_confirmation_invalid: "비활성화 확인 문구가 일치하지 않습니다.",
  mattermost_sender_disable_failed: "Mattermost Sender를 비활성화하지 못했습니다.",
  member_missing_id: "대상을 찾을 수 없습니다.",
  member_invalid_year: "기수는 0~99 사이의 숫자로 입력해 주세요.",
  member_invalid_request: "회원 입력값을 확인해 주세요.",
  member_sync_unavailable: "MM 계정 연결이 없거나 MM 로그인이 이미 중단된 회원입니다. 이메일 로그인 전환 상태와 MM 계정 연결 정보를 확인해 주세요.",
  member_sync_sender_not_configured: "대상 기수의 활성 Mattermost Sender가 없습니다. 운영 페이지에서 Sender를 테스트·활성화한 뒤 다시 시도해 주세요.",
  member_sync_provider_access_denied: "Mattermost Sender의 인증 또는 권한이 부족합니다. Sender 상태와 Mattermost 권한을 확인해 주세요.",
  member_sync_provider_rate_limited: "Mattermost 요청 한도에 도달했습니다. 잠시 후 다시 동기화해 주세요.",
  member_sync_provider_not_found: "Mattermost에서 연결된 사용자를 찾지 못했습니다. 이 오류만으로 회원 상태는 바꾸지 않았습니다.",
  member_sync_provider_invalid_response: "Mattermost가 예상과 다른 응답을 반환했습니다. 회원 상태는 바꾸지 않았으니 잠시 후 다시 시도해 주세요.",
  member_sync_provider_request_rejected: "Mattermost가 동기화 요청을 거부했습니다. MM 사용자 ID와 Sender 권한을 확인해 주세요.",
  member_sync_provider_unavailable: "Mattermost에 연결하지 못했습니다. 회원 상태는 바꾸지 않았으니 잠시 후 다시 시도해 주세요.",
  member_sync_identity_mismatch: "저장된 MM user ID와 Mattermost에서 확인한 계정이 일치하지 않습니다. 다른 계정에 자동 연결하지 않았습니다.",
  member_sync_directory_failed: "MM 계정 디렉터리 정보를 읽거나 저장하지 못했습니다. 회원의 MM 계정 연결 상태를 확인한 뒤 다시 시도해 주세요.",
  member_sync_profile_image_failed: "MM 프로필 사진을 저장하지 못했습니다. 사진 원본과 저장소 상태를 확인한 뒤 다시 동기화해 주세요.",
  member_sync_database_failed: "회원 정보를 읽거나 저장하지 못했습니다. 잠시 후 다시 시도하고, 반복되면 데이터베이스 로그를 확인해 주세요.",
  member_sync_track_failed: "기존 SSAFY 트랙 정보를 처리하지 못했습니다.",
  member_sync_provider_lifecycle_unresolved: "Mattermost 응답만으로 회원 lifecycle을 확정하지 못했습니다. 회원 상태는 바꾸지 않았습니다.",
  member_sync_transition_failed: "MM에서 회원을 찾았지만 이메일 로그인 전환 상태를 저장하지 못했습니다. 동기화를 중단했으니 회원 상태를 확인한 뒤 다시 시도해 주세요.",
  member_sync_failed: "MM 프로필 동기화 중 예상하지 못한 오류가 발생했습니다. 잠시 후 다시 시도하고, 반복되면 감사 로그를 확인해 주세요.",
  member_email_transition_invalid_email: "이메일 형식을 확인해 주세요.",
  member_email_transition_invalid_reason: "MM 이용 중단 사유를 확인해 주세요.",
  member_email_transition_identity_unconfirmed: "대상 회원의 신원과 이메일 소유자를 확인한 뒤 진행해 주세요.",
  member_email_transition_generation_unconfirmed: "기수 전체의 MM 로그인을 중단하는 작업인지 확인해 주세요.",
  member_email_transition_member_missing: "대상 회원을 찾을 수 없습니다.",
  member_email_transition_member_not_linked: "Mattermost 계정이 연결된 회원만 전환할 수 있습니다.",
  member_email_transition_email_mismatch: "이미 인증된 이메일과 다른 주소로는 전환할 수 없습니다.",
  member_email_transition_email_exists: "다른 회원이 사용 중인 이메일입니다.",
  member_email_transition_email_reserved: "탈퇴 이력으로 사용할 수 없는 이메일입니다.",
  member_email_transition_already_completed: "이미 이메일 로그인 전환을 완료한 회원입니다.",
  member_email_transition_delivery_failed: "이메일 설정 링크를 보내지 못했습니다. 설정을 확인한 뒤 다시 시도해 주세요.",
  member_email_transition_failed: "이메일 로그인 전환을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  partner_account_missing_id: "대상을 찾을 수 없습니다.",
  partner_account_invalid_email: "담당자 이메일 형식이 올바르지 않습니다.",
  partner_account_invalid_request: "파트너사 계정 입력값을 확인해 주세요.",
  partner_account_inactive: "비활성화된 계정입니다. 먼저 계정을 활성화해 주세요.",
  partner_account_setup_completed:
    "이미 초기 설정을 마친 계정입니다. 비밀번호를 잊었다면 비밀번호 재설정을 안내해 주세요.",
  partner_account_setup_link_failed:
    "초기설정 URL을 발급하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  partner_account_setup_email_failed:
    "초기설정 URL은 새로 발급했지만 메일을 보내지 못했습니다. 메일 발송 설정을 확인하거나 '초기설정 URL 재생성'으로 받은 링크를 직접 전달해 주세요.",
  partner_account_exists: "이미 존재하는 로그인 아이디입니다.",
  partner_account_create_uncertain:
    "파트너사 계정 생성 중 정리가 끝나지 않았을 수 있습니다. 계정 목록을 확인한 뒤 다시 시도해 주세요.",
  partner_account_company_missing: "연결할 계정과 회사를 찾을 수 없습니다.",
  partner_account_company_invalid_request: "연결 상태 입력값을 확인해 주세요.",
  regional_admin_scope_denied: "배정된 지역의 제휴처 또는 파트너사만 관리할 수 있습니다.",
  admin_global_scope_required: "전역 관리자만 수행할 수 있는 작업입니다.",
  partner_company_plan_invalid_request: "플랜 입력값을 확인해 주세요.",
  partner_company_plan_missing_request: "플랜 요청을 찾을 수 없습니다.",
  partner_company_plan_pending_exists: "이미 처리 대기 중인 업그레이드 요청이 있습니다.",
  partner_company_plan_processed: "이미 처리된 업그레이드 요청입니다.",
  partner_company_plan_payment_unconfirmed: "입금 확인 후 플랜을 승인할 수 있습니다.",
  partner_company_plan_invoice_missing: "청구서를 찾을 수 없습니다.",
  partner_company_plan_partner_missing: "제휴처를 찾을 수 없습니다.",
  partner_company_plan_rejection_paid:
    "입금 확인이 완료된 청구는 반려할 수 없습니다.",
  partner_company_plan_state_changed:
    "제휴처 플랜이 변경되었습니다. 현재 상태를 확인한 뒤 다시 시도해 주세요.",
  partner_company_plan_company_required:
    "파트너사가 연결된 제휴처만 플랜을 변경할 수 있습니다.",
  partner_company_plan_update_failed:
    "플랜 변경을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  partner_company_plan_approval_failed:
    "플랜 업그레이드 승인을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  partner_company_plan_invoice_cancelled: "취소된 청구서는 입금 확인할 수 없습니다.",
  partner_company_plan_payment_confirm_failed:
    "입금 확인 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  review_invalid_request: "리뷰 입력값을 확인해 주세요.",
  review_not_found: "대상을 찾을 수 없습니다.",
  admin_usage_invalid_request: "혜택 적용 이력 입력값을 확인해 주세요.",
  admin_usage_invalid_timestamp: "적용 시각을 확인해 주세요.",
  admin_usage_member_not_found: "회원 정보를 찾을 수 없습니다.",
  admin_usage_benefit_not_found: "제휴처의 혜택 정보를 찾을 수 없습니다.",
  admin_usage_not_found: "혜택 적용 이력을 찾을 수 없습니다.",
  admin_usage_count_exceeded: "선택한 혜택의 최대 적용 횟수를 초과했습니다.",
  admin_usage_database_failed: "혜택 적용 이력을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const satisfies Record<string, string>;

export type AdminActionErrorCode = keyof typeof adminActionErrorMessages;

export function isAdminActionErrorCode(value: unknown): value is AdminActionErrorCode {
  return isAllowedKey(adminActionErrorMessages, value);
}

/** `?error=` 값이 공용 코드면 안내 문구를, 아니면 null을 돌려준다(prototype 키 차단). */
export function getAdminActionErrorMessage(code: unknown): string | null {
  return pickAllowedEntry<string>(adminActionErrorMessages, code);
}

/** 제휴처 상세의 쿠폰 섹션이 표시하는 `?error=` 코드와 문구. */
export const adminPartnerCouponErrorMessages = {
    ad_coupon_create_failed:
      "쿠폰을 생성하지 못했습니다. 입력값과 제휴처 상태를 확인한 뒤 다시 시도해 주세요.",
    ad_coupon_update_failed:
      "쿠폰을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ad_coupon_update_invalid_request: "쿠폰 수정 요청을 다시 확인해 주세요.",
    ad_coupon_update_not_found:
      "수정할 쿠폰을 찾지 못했습니다. 목록을 다시 확인해 주세요.",
    ad_coupon_invalid_status_transition:
      "허용되지 않는 쿠폰 상태 변경입니다. 종료된 쿠폰은 다시 열 수 없으니 복제해서 새 쿠폰으로 운영해 주세요.",
    ad_coupon_state_changed:
      "다른 관리자가 쿠폰 상태를 먼저 바꿨습니다. 현재 상태를 확인한 뒤 다시 저장해 주세요.",
    ad_coupon_duplicate_failed:
      "쿠폰을 복제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ad_coupon_duplicate_invalid_request: "쿠폰 복제 요청을 다시 확인해 주세요.",
    ad_coupon_duplicate_not_found:
      "복제할 쿠폰을 찾지 못했습니다. 목록을 다시 확인해 주세요.",
    ad_coupon_delete_invalid_request: "쿠폰 삭제 요청을 다시 확인해 주세요.",
    ad_coupon_delete_not_found:
      "삭제할 쿠폰을 찾지 못했습니다. 목록을 다시 확인해 주세요.",
    ad_coupon_delete_has_history:
      "발급 또는 사용 이력이 있는 쿠폰은 삭제할 수 없습니다. 수정에서 상태를 종료로 변경해 주세요.",
    ad_coupon_delete_active:
      "활성 쿠폰은 회원이 받는 중일 수 있어 삭제할 수 없습니다. 수정에서 일시중지 또는 종료로 바꾼 뒤 삭제해 주세요.",
    ad_coupon_delete_state_changed:
      "확인하는 사이 쿠폰이 바뀌어 삭제하지 않았습니다. 현재 상태를 확인한 뒤 다시 시도해 주세요.",
    ad_coupon_delete_failed:
      "쿠폰을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  } as const satisfies Record<string, string>;

export type AdminPartnerCouponErrorCode = keyof typeof adminPartnerCouponErrorMessages;

/** 광고 관리 화면이 표시하는 캠페인 `?error=` 코드와 문구. */
export const adminAdCampaignErrorMessages = {
  ad_campaign_invalid_status_transition: "현재 상태에서는 요청한 상태로 변경할 수 없습니다.",
  ad_campaign_state_changed: "확인하는 사이 상태가 바뀌었습니다. 현재 상태를 확인한 뒤 다시 시도해 주세요.",
  ad_campaign_create_failed:
    "광고 캠페인을 생성하지 못했습니다. 입력값과 권한을 확인한 뒤 다시 시도해 주세요.",
  ad_campaign_invalid_request: "광고 캠페인 상태 변경 요청을 다시 확인해 주세요.",
  ad_campaign_invalid_status: "광고 캠페인 상태 변경 요청을 다시 확인해 주세요.",
  ad_campaign_update_failed:
    "광고 캠페인 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const satisfies Record<string, string>;

export type AdminAdCampaignErrorCode = keyof typeof adminAdCampaignErrorMessages;

/** 관리자 이벤트 상세 화면이 표시하는 이벤트 등록·수정·삭제 `?error=` 코드와 문구. */
export const adminEventErrorMessages = {
  admin_event_create_failed:
    "이벤트를 등록하지 못했습니다. 입력값과 운영 권한을 확인한 뒤 다시 시도해 주세요.",
  admin_event_update_failed: "이벤트를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  admin_event_delete_failed: "이벤트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  admin_event_reward_unsupported:
    "이 이벤트는 추첨권 추첨을 지원하지 않습니다. 이벤트를 다시 선택해 주세요.",
} as const satisfies Record<string, string>;

export type AdminEventErrorCode = keyof typeof adminEventErrorMessages;

/**
 * `redirectAdminActionError`가 받는 정적 코드. 공용 맵과 화면이 소유한 맵의 키를 합친 것이며,
 * 어느 맵에도 없는 리터럴은 타입 검사에서 막힌다. 새 코드는 문구와 함께 해당 맵에 먼저 추가한다.
 */
export type AdminRedirectErrorCode =
  | AdminActionErrorCode
  | AdminPartnerCouponErrorCode
  | AdminAdCampaignErrorCode
  | AdminEventErrorCode
  | AdminReviewQueueErrorCode
  | PartnerFormErrorCode
  | NotificationTemplateErrorCode;

declare const dynamicAdminActionErrorCodeBrand: unique symbol;

/**
 * 서비스가 throw한 오류 메시지 중 코드 모양만 통과시킨 값. 정적 코드 집합에 없을 수 있으므로
 * 화면은 자기 메시지 맵에 없는 코드를 일반 문구로 처리해야 한다(동적 코드 탈출구).
 */
export type DynamicAdminActionErrorCode = string & {
  readonly [dynamicAdminActionErrorCodeBrand]: true;
};

const ADMIN_ACTION_ERROR_CODE_PATTERN = /^[a-z][a-z0-9_]{0,79}$/;

/**
 * Server actions may receive either a stable domain error code or an internal
 * provider/database message. Only code-shaped values are allowed to cross the
 * redirect boundary; pages still map unknown codes to their generic message.
 */
export function getSafeAdminActionErrorCode<const Fallback extends string>(
  error: unknown,
  fallback: Fallback,
): Fallback | DynamicAdminActionErrorCode {
  const candidate = error instanceof Error ? error.message.trim() : "";
  return ADMIN_ACTION_ERROR_CODE_PATTERN.test(candidate)
    ? (candidate as DynamicAdminActionErrorCode)
    : fallback;
}
