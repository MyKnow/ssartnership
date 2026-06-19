export type SsafyVerifyClientFailure = {
  ok: false;
  errorCode: string;
  requestId: string | null;
  phase?: string | null;
};

export type SsafyVerifyCallbackPayload = {
  code: string | null;
  state: string | null;
  iss: string | null;
  error: string | null;
  error_code: string | null;
  request_id: string | null;
  message?: string | null;
  phase?: string | null;
  codeVerifier: string;
  authorizeUrl?: string;
};

export type SsafyVerifyClient = {
  verify(options: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    waitForCallback: true;
  }): Promise<SsafyVerifyCallbackPayload>;
};

type CallbackFailurePayload = Pick<
  SsafyVerifyCallbackPayload,
  "error" | "error_code" | "request_id" | "phase"
>;

const defaultFailureCode = "VERIFY_POPUP_FAILED";
const errorCodePattern = /^[A-Z0-9_]{1,96}$/;
const requestIdPattern = /^[A-Za-z0-9_.:-]{1,120}$/;
const phasePattern = /^[a-z][a-z0-9_-]{0,31}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSafeString(
  value: unknown,
  pattern: RegExp,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return pattern.test(value) ? value : null;
}

function normalizeErrorCode(value: unknown, fallback = defaultFailureCode) {
  return readSafeString(value, errorCodePattern) ?? fallback;
}

function normalizeRequestId(value: unknown) {
  return readSafeString(value, requestIdPattern);
}

function normalizePhase(value: unknown) {
  return readSafeString(value, phasePattern);
}

export function normalizeSsafyVerifySdkError(
  error: unknown,
): SsafyVerifyClientFailure {
  const record = isRecord(error) ? error : {};

  return {
    ok: false,
    errorCode: normalizeErrorCode(record.error_code),
    requestId: normalizeRequestId(record.request_id),
    phase: normalizePhase(record.phase),
  };
}

export function normalizeSsafyVerifyCallbackFailure(
  callback: CallbackFailurePayload,
): SsafyVerifyClientFailure {
  return {
    ok: false,
    errorCode: normalizeErrorCode(callback.error_code, "VERIFY_CANCELLED"),
    requestId: normalizeRequestId(callback.request_id),
    phase: normalizePhase(callback.phase),
  };
}

export function getSsafyVerifyClientErrorMessage(errorCode: string) {
  if (errorCode === "MEMBER_NOT_FOUND") {
    return "SSAFY 인증과 연결된 회원 계정을 찾지 못했습니다.";
  }
  if (errorCode === "SSAFY_MEMBER_CONFLICT") {
    return "이미 다른 계정에 연결된 SSAFY 인증입니다. 기존 계정을 확인해 주세요.";
  }
  if (errorCode === "VERIFY_RATE_LIMITED") {
    return "인증 요청이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (errorCode === "SDK_NOT_READY") {
    return "SSAFY Verify를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  if (errorCode === "VERIFY_CANCELLED" || errorCode === "CONSENT_DENIED") {
    return "SSAFY 인증이 취소되었습니다.";
  }
  if (errorCode === "SSAFY_VERIFY_POPUP_BLOCKED") {
    return "브라우저에서 인증 팝업을 열 수 없습니다. 팝업 차단을 해제한 뒤 다시 시도해 주세요.";
  }
  if (errorCode === "SSAFY_VERIFY_POPUP_CLOSED") {
    return "SSAFY 인증 창이 닫혔습니다. 인증을 다시 시작해 주세요.";
  }
  if (errorCode === "SSAFY_VERIFY_CALLBACK_TIMEOUT") {
    return "SSAFY 인증 결과를 받지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
  }
  if (
    errorCode === "SSAFY_VERIFY_REDIRECT_URI_INVALID" ||
    errorCode === "SSAFY_VERIFY_REDIRECT_ORIGIN_MISMATCH" ||
    errorCode === "REDIRECT_URI_MISMATCH"
  ) {
    return "현재 접속 주소에서는 SSAFY 인증을 사용할 수 없습니다. 운영 설정을 확인해 주세요.";
  }
  if (
    errorCode === "SSAFY_VERIFY_STATE_MISMATCH" ||
    errorCode === "CALLBACK_ISSUER_MISMATCH"
  ) {
    return "인증 응답을 안전하게 확인하지 못했습니다. 다시 시도해 주세요.";
  }
  if (errorCode === "VERIFY_NETWORK_FAILED") {
    return "SSAFY 인증 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (errorCode === "VERIFY_RESPONSE_INVALID") {
    return "SSAFY 인증 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "SSAFY 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
