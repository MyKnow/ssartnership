export type PartnerChangeRequestErrorCode =
  | "not_found"
  | "forbidden"
  | "pending_exists"
  | "already_resolved"
  | "no_changes"
  | "invalid_request";

export class PartnerChangeRequestError extends Error {
  code: PartnerChangeRequestErrorCode;

  constructor(code: PartnerChangeRequestErrorCode, message: string) {
    super(message);
    this.name = "PartnerChangeRequestError";
    this.code = code;
  }
}

export function getPartnerChangeRequestErrorMessage(
  code: PartnerChangeRequestErrorCode,
) {
  switch (code) {
    case "not_found":
      return "요청을 찾을 수 없습니다.";
    case "forbidden":
      return "해당 요청에 접근할 수 없습니다.";
    case "pending_exists":
      return "이미 승인 대기 중인 요청이 있습니다. 먼저 취소하거나 처리 결과를 기다려 주세요.";
    case "already_resolved":
      return "이미 처리된 요청입니다.";
    case "no_changes":
      return "현재 값과 다른 변경이 없어 요청을 보낼 수 없습니다.";
    case "invalid_request":
      return "요청 값을 다시 확인해 주세요.";
    default:
      return "변경 요청 처리에 실패했습니다.";
  }
}

export function getPartnerChangeRequestErrorStatus(
  code: PartnerChangeRequestErrorCode,
) {
  switch (code) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "pending_exists":
    case "already_resolved":
    case "no_changes":
      return 409;
    case "invalid_request":
      return 400;
    default:
      return 400;
  }
}
