import {
  getPartnerPortalLoginErrorMessage,
  type PartnerPortalLoginErrorCode,
} from "@/lib/partner-auth";

export type PartnerLoginSearchParams = {
  error?: string | string[];
  loginId?: string | string[];
  setup?: string | string[];
};

export function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function getLoginErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "blocked":
      return "로그인이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.";
    case "server_error":
      return "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    case "invalid_request":
      return "이메일과 비밀번호를 모두 입력해 주세요.";
    case "invalid_email":
      return "이메일 형식이 올바르지 않습니다.";
    case "invalid_credentials":
    case "inactive_account":
    case "setup_required":
    case "not_linked":
      return getPartnerPortalLoginErrorMessage(
        errorCode satisfies PartnerPortalLoginErrorCode,
      );
    default:
      return null;
  }
}

export function buildPartnerLoginErrorRedirect(
  errorCode: string,
  loginId?: string | null,
) {
  return `/partner/login?error=${encodeURIComponent(errorCode)}${
    loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
  }`;
}
