export type AdminReviewQueueFeedbackTone = "info" | "success" | "danger";

export type AdminReviewQueueFeedback = {
  tone: AdminReviewQueueFeedbackTone;
  title: string;
  description: string;
};

type FeedbackQuery = {
  error?: string | null;
  success?: string | null;
};

const SUCCESS_MESSAGES: Record<string, AdminReviewQueueFeedback> = {
  approved: {
    tone: "success",
    title: "처리 완료",
    description: "검토 항목을 승인했습니다.",
  },
  rejected: {
    tone: "success",
    title: "처리 완료",
    description: "검토 항목을 반려했습니다.",
  },
  updated: {
    tone: "success",
    title: "저장 완료",
    description: "검토 상태를 저장했습니다.",
  },
  "details-updated": {
    tone: "success",
    title: "저장 완료",
    description: "제휴 등록 신청 정보를 저장했습니다.",
  },
  "already-updated": {
    tone: "info",
    title: "최신 상태를 확인했습니다",
    description: "다른 관리자가 먼저 상태를 변경했습니다. 현재 목록에서 최신 내용을 확인하세요.",
  },
};

const ERROR_MESSAGES: Record<string, AdminReviewQueueFeedback> = {
  invalid_fields: {
    tone: "danger",
    title: "입력을 확인해 주세요",
    description: "필수 검토 정보를 확인한 뒤 다시 시도해 주세요.",
  },
  invalid_reason: {
    tone: "danger",
    title: "반려 사유를 확인해 주세요",
    description: "반려 사유를 1~500자로 입력해 주세요.",
  },
  approval_failed: {
    tone: "danger",
    title: "승인하지 못했습니다",
    description: "항목이 이미 처리되었거나 일시적인 문제가 있을 수 있습니다. 목록을 새로고침한 뒤 다시 확인해 주세요.",
  },
  rejection_failed: {
    tone: "danger",
    title: "반려하지 못했습니다",
    description: "항목이 이미 처리되었거나 일시적인 문제가 있을 수 있습니다. 목록을 새로고침한 뒤 다시 확인해 주세요.",
  },
  review_start_failed: {
    tone: "danger",
    title: "검토를 시작하지 못했습니다",
    description: "항목 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.",
  },
  resubmission_request_failed: {
    tone: "danger",
    title: "보완 요청을 처리하지 못했습니다",
    description: "검토 항목을 새로 확인한 뒤 다시 시도해 주세요.",
  },
  setup_email_resend_failed: {
    tone: "danger",
    title: "메일을 다시 보내지 못했습니다",
    description: "잠시 후 다시 시도해 주세요.",
  },
  active_photo_rejection_failed: {
    tone: "danger",
    title: "기존 사진을 반려하지 못했습니다",
    description: "회원의 현재 상태를 확인한 뒤 다시 시도해 주세요.",
  },
  partner_form_invalid_request: {
    tone: "danger",
    title: "요청을 처리하지 못했습니다",
    description: "검토 항목을 새로 확인한 뒤 다시 시도해 주세요.",
  },
  partner_form_not_found: {
    tone: "danger",
    title: "검토 대상을 찾을 수 없습니다",
    description: "목록을 새로고침해 최신 상태를 확인해 주세요.",
  },
  partner_form_conversion_failed: {
    tone: "danger",
    title: "제휴처 생성을 완료하지 못했습니다",
    description:
      "신청 상태는 저장되었지만 제휴처 후속 처리가 끝나지 않았습니다. 운영 기록과 제휴처 목록을 확인해 중복 등록 여부를 점검해 주세요.",
  },
  partner_form_details_invalid: {
    tone: "danger",
    title: "신청 정보 저장을 확인해 주세요",
    description: "필수 항목과 링크·기간 형식을 확인한 뒤 다시 시도해 주세요.",
  },
  partner_form_details_locked: {
    tone: "info",
    title: "등록 완료 신청은 여기서 수정하지 않습니다",
    description: "등록 완료 후 정보는 제휴처 상세 화면에서 수정해 주세요.",
  },
  partner_form_multiple_groups: {
    tone: "info",
    title: "혜택 그룹별 수정이 필요합니다",
    description: "혜택 그룹이 여러 개인 신청은 그룹별 편집 화면에서 확인한 뒤 저장해 주세요.",
  },
  regional_admin_scope_denied: {
    tone: "danger",
    title: "접근 범위를 확인해 주세요",
    description: "현재 관리자에게 허용된 지역의 항목만 처리할 수 있습니다.",
  },
};

const GENERIC_ERROR: AdminReviewQueueFeedback = {
  tone: "danger",
  title: "요청을 처리하지 못했습니다",
  description: "잠시 후 다시 시도해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요.",
};

export function getAdminReviewQueueFeedback({
  error,
  success,
}: FeedbackQuery): AdminReviewQueueFeedback | null {
  if (success) return SUCCESS_MESSAGES[success] ?? null;
  if (!error) return null;
  return ERROR_MESSAGES[error] ?? GENERIC_ERROR;
}

export function appendAdminReviewQueueQuery(
  path: string,
  values: Record<string, string | null | undefined>,
) {
  const url = new URL(path, "https://admin.local");
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
