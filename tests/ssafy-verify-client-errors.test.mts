import assert from "node:assert/strict";
import test from "node:test";

const clientErrorsModulePromise = import(
  new URL("../src/lib/ssafy-verify/client-errors.ts", import.meta.url).href,
);

test("SSAFY Verify SDK errors preserve safe public fields", async () => {
  const { normalizeSsafyVerifySdkError } = await clientErrorsModulePromise;

  assert.deepEqual(
    normalizeSsafyVerifySdkError({
      error: "invalid_request",
      error_code: "SSAFY_VERIFY_REDIRECT_ORIGIN_MISMATCH",
      message: "internal details must not be surfaced directly",
      request_id: "req_123",
      phase: "preflight",
    }),
    {
      ok: false,
      errorCode: "SSAFY_VERIFY_REDIRECT_ORIGIN_MISMATCH",
      requestId: "req_123",
      phase: "preflight",
    },
  );
});

test("SSAFY Verify SDK errors drop unsafe arbitrary fields", async () => {
  const { normalizeSsafyVerifySdkError } = await clientErrorsModulePromise;

  assert.deepEqual(
    normalizeSsafyVerifySdkError({
      error_code: "bad code with spaces",
      request_id: "req_123<script>",
      phase: "callback",
      code: "authorization-code-must-not-leak",
      codeVerifier: "pkce-verifier-must-not-leak",
    }),
    {
      ok: false,
      errorCode: "VERIFY_POPUP_FAILED",
      requestId: null,
      phase: "callback",
    },
  );
});

test("SSAFY Verify callback failures map to stable client failures", async () => {
  const { normalizeSsafyVerifyCallbackFailure } = await clientErrorsModulePromise;

  assert.deepEqual(
    normalizeSsafyVerifyCallbackFailure({
      error: "access_denied",
      error_code: "CONSENT_DENIED",
      request_id: "req_cancel",
      phase: "callback",
    }),
    {
      ok: false,
      errorCode: "CONSENT_DENIED",
      requestId: "req_cancel",
      phase: "callback",
    },
  );
});

test("SSAFY Verify client error messages distinguish setup and user actions", async () => {
  const { getSsafyVerifyClientErrorMessage } = await clientErrorsModulePromise;

  assert.match(
    getSsafyVerifyClientErrorMessage("SSAFY_VERIFY_REDIRECT_ORIGIN_MISMATCH"),
    /접속 주소/,
  );
  assert.match(
    getSsafyVerifyClientErrorMessage("SSAFY_VERIFY_POPUP_CLOSED"),
    /닫혔/,
  );
  assert.match(
    getSsafyVerifyClientErrorMessage("SSAFY_VERIFY_CALLBACK_TIMEOUT"),
    /결과를 받지 못했습니다/,
  );
  assert.match(
    getSsafyVerifyClientErrorMessage("SSAFY_VERIFY_POPUP_BLOCKED"),
    /같은 창/,
  );
  assert.doesNotMatch(
    getSsafyVerifyClientErrorMessage("SSAFY_VERIFY_POPUP_BLOCKED"),
    /팝업 차단을 해제/,
  );
  assert.match(
    getSsafyVerifyClientErrorMessage("SSAFY_VERIFY_REDIRECT_SESSION_MISSING"),
    /만료/,
  );
  assert.match(getSsafyVerifyClientErrorMessage("CONSENT_DENIED"), /취소/);
});
