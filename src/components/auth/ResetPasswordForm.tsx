"use client";

import Script from "next/script";
import { useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import {
  getSsafyVerifyClientErrorMessage,
  normalizeSsafyVerifyCallbackFailure,
  normalizeSsafyVerifySdkError,
  type SsafyVerifyCallbackPayload,
  type SsafyVerifyClient,
  type SsafyVerifyClientFailure,
} from "@/lib/ssafy-verify/client-errors";
import { buildSsafyVerifyRedirectUri } from "@/lib/ssafy-verify/redirect";
import { SSAFY_VERIFY_REAUTH_SCOPES } from "@/lib/ssafy-verify/scopes";

type ResetPasswordVerifyResult =
  | {
      ok: true;
      verified: true;
      completionToken: string;
      mmUsername: string;
      authTime: number;
    }
  | SsafyVerifyClientFailure;

declare global {
  interface Window {
    ssafyVerify?: SsafyVerifyClient;
  }
}

const sdkUrl = "https://verify.myknow.xyz/sdk/ssafy-verify.js";
const defaultIssuer = "https://verify.myknow.xyz";

function getErrorMessage(result: Extract<ResetPasswordVerifyResult, { ok: false }>) {
  if (result.errorCode === "MEMBER_NOT_FOUND") {
    return "SSAFY 인증과 연결된 회원 계정을 찾지 못했습니다.";
  }
  if (result.errorCode === "SSAFY_MEMBER_CONFLICT") {
    return "이미 다른 계정에 연결된 SSAFY 인증입니다. 기존 계정을 확인해 주세요.";
  }
  if (result.errorCode === "VERIFY_RATE_LIMITED") {
    return "인증 요청이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (result.errorCode === "SDK_NOT_READY") {
    return "SSAFY Verify를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  if (result.errorCode === "VERIFY_CANCELLED") {
    return "SSAFY 인증이 취소되었습니다.";
  }
  return getSsafyVerifyClientErrorMessage(result.errorCode);
}

export default function ResetPasswordForm() {
  const [status, setStatus] = useState<"idle" | "working" | "failed">("idle");
  const [error, setError] = useState<
    Extract<ResetPasswordVerifyResult, { ok: false }> | null
  >(null);

  async function verify() {
    if (status === "working") {
      return;
    }

    const sdk = window.ssafyVerify;
    if (!sdk) {
      setStatus("failed");
      setError({ ok: false, errorCode: "SDK_NOT_READY", requestId: null });
      return;
    }

    setStatus("working");
    setError(null);

    const expectedIssuer = defaultIssuer;
    const redirectUri = buildSsafyVerifyRedirectUri(window.location.origin);

    let callback: SsafyVerifyCallbackPayload;
    try {
      callback = await sdk.verify({
        clientId: process.env.NEXT_PUBLIC_SSAFY_VERIFY_CLIENT_ID ?? "",
        redirectUri,
        scopes: [...SSAFY_VERIFY_REAUTH_SCOPES],
        waitForCallback: true,
      });
    } catch (sdkError) {
      setStatus("failed");
      setError(normalizeSsafyVerifySdkError(sdkError));
      return;
    }

    if (callback.error || !callback.code) {
      setStatus("failed");
      setError(normalizeSsafyVerifyCallbackFailure(callback));
      return;
    }

    if (callback.iss !== expectedIssuer) {
      setStatus("failed");
      setError({
        ok: false,
        errorCode: "CALLBACK_ISSUER_MISMATCH",
        requestId: callback.request_id,
      });
      return;
    }

    const response = await fetch("/api/ssafy/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: callback.code,
        codeVerifier: callback.codeVerifier,
        redirectUri,
        iss: callback.iss,
      }),
    }).then((value) => value, () => null);

    if (!response) {
      setStatus("failed");
      setError({ ok: false, errorCode: "VERIFY_NETWORK_FAILED", requestId: null });
      return;
    }

    const result = await response.json().then(
      (value) => value as ResetPasswordVerifyResult,
      () => ({ ok: false as const, errorCode: "VERIFY_RESPONSE_INVALID", requestId: null }),
    );

    if (!result.ok) {
      setStatus("failed");
      setError(result);
      return;
    }

    if (!result.completionToken) {
      setStatus("failed");
      setError({
        ok: false,
        errorCode: "VERIFY_RESPONSE_INVALID",
        requestId: null,
      });
      return;
    }

    window.location.replace(
      `/auth/reset/complete?token=${encodeURIComponent(result.completionToken)}`,
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Script src={sdkUrl} strategy="afterInteractive" />
      <Button onClick={verify} loading={status === "working"} loadingText="인증 중">
        SSAFY 인증으로 비밀번호 재설정
      </Button>
      {error ? (
        <FormMessage variant="error">
          {getErrorMessage(error)}
        </FormMessage>
      ) : null}
    </div>
  );
}
