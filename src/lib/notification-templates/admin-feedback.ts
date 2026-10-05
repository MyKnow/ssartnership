import { pickAllowedEntry } from "@/lib/safe-messages";

export type NotificationTemplateFeedback = {
  tone: "info" | "error";
  message: string;
};

const STATUS_MESSAGES = {
  updated: {
    tone: "info",
    message: "알림 템플릿을 저장했습니다.",
  },
  reset: {
    tone: "info",
    message: "알림 템플릿을 기본값으로 복원했습니다.",
  },
  "test-sent": {
    tone: "info",
    message: "선택한 회원에게 템플릿 테스트 발송을 완료했습니다.",
  },
} satisfies Record<string, NotificationTemplateFeedback>;

const ERROR_MESSAGES = {
  invalid_request: {
    tone: "error",
    message: "입력한 템플릿·채널·수신 회원 정보를 확인해 주세요.",
  },
  save_failed: {
    tone: "error",
    message: "알림 템플릿을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
  reset_failed: {
    tone: "error",
    message: "알림 템플릿을 기본값으로 복원하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
  test_failed: {
    tone: "error",
    message: "테스트 발송에 실패했습니다. 채널 설정과 수신 회원 상태를 확인해 주세요.",
  },
} satisfies Record<string, NotificationTemplateFeedback>;

/** 알림 템플릿 화면이 소유한 `?error=` 코드. */
export type NotificationTemplateErrorCode = keyof typeof ERROR_MESSAGES;

const GENERIC_ERROR: NotificationTemplateFeedback = {
  tone: "error",
  message: "알림 템플릿 작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export function getNotificationTemplateFeedback(input: {
  status?: string | null;
  error?: string | null;
}) {
  if (input.status) {
    return pickAllowedEntry<NotificationTemplateFeedback>(STATUS_MESSAGES, input.status);
  }
  if (input.error) {
    return pickAllowedEntry<NotificationTemplateFeedback>(ERROR_MESSAGES, input.error) ?? GENERIC_ERROR;
  }
  return null;
}
