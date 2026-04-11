export type PartnerPortalPasswordResetErrorCode =
  | "invalid_email"
  | "not_found"
  | "inactive_account"
  | "setup_required"
  | "send_failed";

export type PartnerPortalPasswordChangeErrorCode =
  | "unauthorized"
  | "wrong_password"
  | "invalid_password";

export class PartnerPortalPasswordResetError extends Error {
  code: PartnerPortalPasswordResetErrorCode;

  constructor(code: PartnerPortalPasswordResetErrorCode, message: string) {
    super(message);
    this.name = "PartnerPortalPasswordResetError";
    this.code = code;
  }
}

export class PartnerPortalPasswordChangeError extends Error {
  code: PartnerPortalPasswordChangeErrorCode;

  constructor(code: PartnerPortalPasswordChangeErrorCode, message: string) {
    super(message);
    this.name = "PartnerPortalPasswordChangeError";
    this.code = code;
  }
}

export function getPartnerPortalPasswordResetErrorMessage(
  code: PartnerPortalPasswordResetErrorCode,
) {
  switch (code) {
    case "invalid_email":
      return "이메일 형식이 올바르지 않습니다.";
    case "not_found":
      return "해당 이메일로 등록된 계정을 찾을 수 없습니다.";
    case "inactive_account":
      return "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
    case "setup_required":
      return "아직 초기 설정이 완료되지 않았습니다. 초기 설정 링크를 먼저 사용해 주세요.";
    case "send_failed":
      return "임시 비밀번호 전송에 실패했습니다.";
    default:
      return "비밀번호 재설정에 실패했습니다.";
  }
}

export function getPartnerPortalPasswordResetErrorStatus(
  code: PartnerPortalPasswordResetErrorCode,
) {
  switch (code) {
    case "invalid_email":
      return 400;
    case "not_found":
      return 404;
    case "inactive_account":
      return 403;
    case "setup_required":
      return 409;
    case "send_failed":
      return 500;
    default:
      return 400;
  }
}

export function getPartnerPortalPasswordChangeErrorMessage(
  code: PartnerPortalPasswordChangeErrorCode,
) {
  switch (code) {
    case "unauthorized":
      return "로그인 후 다시 시도해 주세요.";
    case "wrong_password":
      return "현재 비밀번호가 올바르지 않습니다.";
    case "invalid_password":
      return "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.";
    default:
      return "비밀번호 변경에 실패했습니다.";
  }
}

export function getPartnerPortalPasswordChangeErrorStatus(
  code: PartnerPortalPasswordChangeErrorCode,
) {
  switch (code) {
    case "unauthorized":
      return 401;
    case "wrong_password":
      return 400;
    case "invalid_password":
      return 400;
    default:
      return 400;
  }
}
