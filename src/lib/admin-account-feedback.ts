export type AdminAccountFeedback = {
  tone: "info" | "error";
  message: string;
};

const SUCCESS_MESSAGES: Record<string, AdminAccountFeedback> = {
  granted: { tone: "info", message: "회원에게 관리자 권한을 부여했습니다." },
  created: { tone: "info", message: "회원에게 관리자 권한을 부여했습니다." },
  activated: { tone: "info", message: "관리자 권한을 활성화했습니다." },
  revoked: { tone: "info", message: "관리자 권한을 회수했습니다." },
  deactivated: { tone: "info", message: "관리자 권한을 회수했습니다." },
  "permissions-updated": { tone: "info", message: "관리자 권한을 저장했습니다." },
  "template-applied": { tone: "info", message: "권한 템플릿을 적용했습니다." },
};

const ERROR_MESSAGES: Record<string, AdminAccountFeedback> = {
  admin_account_invalid_request: {
    tone: "error",
    message: "입력한 회원·권한·관리 캠퍼스를 확인해 주세요.",
  },
  admin_account_transition_denied: {
    tone: "error",
    message: "이 관리자 권한은 현재 상태에서 변경할 수 없습니다. 권한 구성을 다시 확인해 주세요.",
  },
  admin_account_unsupported_setup: {
    tone: "error",
    message: "이 관리자 권한 방식에서는 초기 설정 링크를 사용할 수 없습니다.",
  },
  admin_account_action_failed: {
    tone: "error",
    message: "관리자 작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
};

const GENERIC_ERROR_MESSAGE = ERROR_MESSAGES.admin_account_action_failed;

export function getAdminAccountFeedback(status: string | undefined) {
  if (!status) return null;
  return SUCCESS_MESSAGES[status] ?? ERROR_MESSAGES[status] ?? GENERIC_ERROR_MESSAGE;
}

export function getAdminAccountActionErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("자기 자신의 관리자 권한")
    || message.includes("마지막 최고 권한 관리자")
    || message.includes("Super Admin 권한은")
  ) {
    return "admin_account_transition_denied";
  }

  if (
    message.includes("회원 아이디")
    || message.includes("회원을 찾을 수 없습니다")
    || message.includes("권한 템플릿")
    || message.includes("관리 캠퍼스")
    || message.includes("권한을 가진 회원을 찾을 수 없습니다")
  ) {
    return "admin_account_invalid_request";
  }

  return "admin_account_action_failed";
}
