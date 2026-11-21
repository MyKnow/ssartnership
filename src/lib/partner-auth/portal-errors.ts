export type PartnerPortalSetupErrorCode =
  | "not_found"
  | "already_completed"
  | "invalid_password"
  | "password_mismatch";

export type PartnerPortalLoginErrorCode =
  | "invalid_credentials"
  | "inactive_account"
  | "setup_required"
  | "not_linked";

export class PartnerPortalSetupError extends Error {
  code: PartnerPortalSetupErrorCode;

  constructor(code: PartnerPortalSetupErrorCode, message: string) {
    super(message);
    this.name = "PartnerPortalSetupError";
    this.code = code;
  }
}

export class PartnerPortalLoginError extends Error {
  code: PartnerPortalLoginErrorCode;

  constructor(code: PartnerPortalLoginErrorCode, message: string) {
    super(message);
    this.name = "PartnerPortalLoginError";
    this.code = code;
  }
}

export function getPartnerPortalSetupErrorMessage(
  code: PartnerPortalSetupErrorCode,
) {
  switch (code) {
    case "not_found":
      return "초기 설정 링크를 찾을 수 없습니다.";
    case "already_completed":
      return "이미 초기 설정이 완료되었습니다.";
    case "invalid_password":
      return "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.";
    case "password_mismatch":
      return "비밀번호 확인이 일치하지 않습니다.";
    default:
      return "초기 설정에 실패했습니다.";
  }
}

export function getPartnerPortalLoginErrorMessage(
  code: PartnerPortalLoginErrorCode,
) {
  switch (code) {
    case "invalid_credentials":
    case "inactive_account":
    case "setup_required":
    case "not_linked":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    default:
      return "로그인에 실패했습니다.";
  }
}

export function getPartnerPortalLoginErrorStatus(
  code: PartnerPortalLoginErrorCode,
) {
  switch (code) {
    case "invalid_credentials":
    case "inactive_account":
    case "setup_required":
    case "not_linked":
      return 401;
    default:
      return 400;
  }
}
