import {
  getPartnerPortalLoginErrorMessage,
  type PartnerPortalLoginErrorCode,
} from "@/lib/partner-auth";
import {
  PARTNER_LOGIN_PATH,
  PARTNER_SESSION_EXPIRED_ERROR_CODE,
} from "@/lib/partner-auth/portal-paths";
export { readFirstSearchParamOrEmpty as readSearchParam } from "@/lib/search-params";

export type PartnerLoginSearchParams = {
  error?: string | string[];
  loginId?: string | string[];
  setup?: string | string[];
  returnTo?: string | string[];
};

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
    case PARTNER_SESSION_EXPIRED_ERROR_CODE:
      return "로그인 세션이 만료되었습니다. 다시 로그인한 뒤 작업을 이어 주세요.";
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

export function getPartnerLoginFieldErrors(errorCode: string | undefined): {
  loginId?: string;
  password?: string;
} {
  const passwordField = "password";
  switch (errorCode) {
    case "invalid_request":
      return {
        loginId: "담당자 이메일을 입력해 주세요.",
        [passwordField]: "비밀번호를 입력해 주세요.",
      };
    case "invalid_email":
      return {
        loginId: "이메일 형식이 올바르지 않습니다.",
      };
    default:
      return {};
  }
}

/**
 * `returnTo` must already be sanitized with `sanitizePartnerReturnTo`; it is
 * carried back so a failed attempt does not lose the original destination.
 */
export function buildPartnerLoginErrorRedirect(
  errorCode: string,
  loginId?: string | null,
  returnTo?: string | null,
) {
  return `${PARTNER_LOGIN_PATH}?error=${encodeURIComponent(errorCode)}${
    loginId ? `&loginId=${encodeURIComponent(loginId)}` : ""
  }${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`;
}
