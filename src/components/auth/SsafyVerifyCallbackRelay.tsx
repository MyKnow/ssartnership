"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeReturnTo } from "@/lib/return-to";
import {
  clearSsafyVerifyRedirectSession,
  readSsafyVerifyCallbackPayload,
  readSsafyVerifyRedirectSession,
} from "@/lib/ssafy-verify/client-redirect";
import {
  getSsafyVerifyClientErrorMessage,
  normalizeSsafyVerifyCallbackFailure,
  normalizeSsafyVerifyClientFailure,
  type SsafyVerifyCallbackPayload,
  type SsafyVerifyClientFailure,
} from "@/lib/ssafy-verify/client-errors";
import {
  reportSsafyVerifyClientFailure,
} from "@/lib/ssafy-verify/client-failure-reporter";
import type { SsafyVerifyClientFailurePurpose } from "@/lib/ssafy-verify/client-failure-report";

type MemberVerifyResult =
  | {
      ok: true;
      verified: true;
      status?: "verified" | "signup_required";
      cohort: string | null;
      campus: string | null;
      authTime: number;
      requiresConsent: boolean;
      nextPath?: string;
    }
  | (SsafyVerifyClientFailure & {
      redirectTo?: string;
    });

type ResetPasswordVerifyResult =
  | {
      ok: true;
      verified: true;
      resetPath: string;
      mmUsername: string;
      authTime: number;
    }
  | SsafyVerifyClientFailure;

const defaultIssuer = "https://verify.myknow.xyz";

function toCallbackRelayMessage(callback: SsafyVerifyCallbackPayload) {
  return {
    source: "ssafy-verify.callback",
    code: callback.code,
    state: callback.state,
    iss: callback.iss,
    error: callback.error,
    error_code: callback.error_code,
    request_id: callback.request_id,
    message: callback.message,
    phase: callback.phase ?? "callback",
  };
}

function getMemberVerifyErrorMessage(errorCode: string) {
  if (errorCode === "MEMBER_NOT_FOUND") {
    return "기존 회원 정보와 연결하지 못했습니다. 기존 로그인 후 다시 시도해 주세요.";
  }
  if (errorCode === "MEMBER_ALREADY_REGISTERED") {
    return "이미 가입된 사용자입니다. 로그인해 주세요.";
  }
  if (errorCode === "SSAFY_MEMBER_CONFLICT") {
    return "이미 다른 계정에 연결된 SSAFY 인증입니다. 기존 계정으로 로그인해 주세요.";
  }
  if (errorCode === "SSAFY_SIGNUP_PROFILE_UNAVAILABLE") {
    return "회원가입에 필요한 SSAFY 프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (errorCode === "SSAFY_SIGNUP_PROFILE_NOT_FOUND") {
    return "SSAFY Verify에서 인증된 프로필을 찾지 못했습니다. 운영 설정을 확인해 주세요.";
  }
  if (errorCode === "SSAFY_SIGNUP_YEAR_NOT_ALLOWED") {
    return "현재 가입 대상 기수가 아닙니다.";
  }
  return getSsafyVerifyClientErrorMessage(errorCode);
}

function getResetPasswordErrorMessage(errorCode: string) {
  if (errorCode === "MEMBER_NOT_FOUND") {
    return "SSAFY 인증과 연결된 회원 계정을 찾지 못했습니다.";
  }
  if (errorCode === "SSAFY_MEMBER_CONFLICT") {
    return "이미 다른 계정에 연결된 SSAFY 인증입니다. 기존 계정을 확인해 주세요.";
  }
  return getSsafyVerifyClientErrorMessage(errorCode);
}

async function readJsonResponse<T>(response: Response | null, fallback: T) {
  if (!response) {
    return fallback;
  }
  return response.json().then(
    (value) => value as T,
    () => fallback,
  );
}

export default function SsafyVerifyCallbackRelay() {
  const [status, setStatus] = useState<"waiting" | "processing" | "sent" | "failed">(
    "waiting",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const didRelayRef = useRef(false);

  const fail = useCallback(
    (
      failure: SsafyVerifyClientFailure,
      message: string,
      purpose: SsafyVerifyClientFailurePurpose,
    ) => {
      setErrorMessage(message);
      setStatus("failed");
      reportSsafyVerifyClientFailure({ purpose, failure });
    },
    [],
  );

  const relayCallback = useCallback(async () => {
    if (didRelayRef.current) {
      return;
    }

    didRelayRef.current = true;
    const callback = readSsafyVerifyCallbackPayload();

    if (window.opener) {
      window.opener.postMessage(toCallbackRelayMessage(callback), window.location.origin);
      setStatus("sent");
      window.setTimeout(() => window.close(), 50);
      return;
    }

    const session = readSsafyVerifyRedirectSession();
    if (!session) {
      const failure = normalizeSsafyVerifyClientFailure({
        errorCode: "SSAFY_VERIFY_REDIRECT_SESSION_MISSING",
        requestId: null,
        phase: "redirect-session",
      });
      fail(
        failure,
        getSsafyVerifyClientErrorMessage(failure.errorCode),
        "member-login",
      );
      return;
    }

    clearSsafyVerifyRedirectSession();

    if (callback.state !== session.state) {
      const failure = normalizeSsafyVerifyClientFailure({
        errorCode: "SSAFY_VERIFY_STATE_MISMATCH",
        requestId: callback.request_id,
        phase: "callback",
      });
      fail(
        failure,
        getSsafyVerifyClientErrorMessage(failure.errorCode),
        session.purpose,
      );
      return;
    }

    if (callback.error || !callback.code) {
      const failure = normalizeSsafyVerifyCallbackFailure(callback);
      fail(
        { ...failure, phase: failure.phase ?? "callback" },
        getSsafyVerifyClientErrorMessage(failure.errorCode),
        session.purpose,
      );
      return;
    }

    if (callback.iss !== defaultIssuer) {
      const failure = normalizeSsafyVerifyClientFailure({
        errorCode: "CALLBACK_ISSUER_MISMATCH",
        requestId: callback.request_id,
        phase: "callback",
      });
      fail(
        failure,
        getSsafyVerifyClientErrorMessage(failure.errorCode),
        session.purpose,
      );
      return;
    }

    setStatus("processing");

    if (session.purpose === "reset-password") {
      const response = await fetch("/api/ssafy/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: callback.code,
          codeVerifier: session.codeVerifier,
          redirectUri: session.redirectUri,
          iss: callback.iss,
        }),
      }).then((value) => value, () => null);

      const result = await readJsonResponse<ResetPasswordVerifyResult>(response, {
        ok: false,
        errorCode: response ? "VERIFY_RESPONSE_INVALID" : "VERIFY_NETWORK_FAILED",
        requestId: null,
      });

      if (!result.ok) {
        const failure = normalizeSsafyVerifyClientFailure(result);
        fail(
          { ...failure, phase: failure.phase ?? "token-exchange" },
          getResetPasswordErrorMessage(failure.errorCode),
          "reset-password",
        );
        return;
      }

      if (!result.resetPath) {
        const failure = normalizeSsafyVerifyClientFailure({
          errorCode: "VERIFY_RESPONSE_INVALID",
          requestId: null,
          phase: "token-exchange",
        });
        fail(
          failure,
          getSsafyVerifyClientErrorMessage(failure.errorCode),
          "reset-password",
        );
        return;
      }

      setStatus("sent");
      window.location.replace(result.resetPath);
      return;
    }

    const response = await fetch("/api/ssafy/verify-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: callback.code,
        codeVerifier: session.codeVerifier,
        redirectUri: session.redirectUri,
        iss: callback.iss,
      }),
    }).then((value) => value, () => null);

    const result = await readJsonResponse<MemberVerifyResult>(response, {
      ok: false,
      errorCode: response ? "VERIFY_RESPONSE_INVALID" : "VERIFY_NETWORK_FAILED",
      requestId: null,
    });

    if (!result.ok) {
      const failure = normalizeSsafyVerifyClientFailure(result);
      if (failure.errorCode === "MEMBER_ALREADY_REGISTERED") {
        sessionStorage.setItem("signup:alreadyRegistered", "1");
        window.location.replace(result.redirectTo ?? "/auth/login");
        return;
      }
      fail(
        { ...failure, phase: failure.phase ?? "token-exchange" },
        getMemberVerifyErrorMessage(failure.errorCode),
        "member-login",
      );
      return;
    }

    const safeReturnTo = sanitizeReturnTo(session.returnTo, "/");
    if (result.status === "signup_required") {
      const nextPath = result.nextPath ?? "/auth/signup/complete";
      setStatus("sent");
      window.location.replace(`${nextPath}?returnTo=${encodeURIComponent(safeReturnTo)}`);
      return;
    }

    const nextHref = result.requiresConsent
      ? `/auth/consent?returnTo=${encodeURIComponent(safeReturnTo)}`
      : safeReturnTo;
    setStatus("sent");
    window.location.replace(nextHref);
  }, [fail]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void relayCallback();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [relayCallback]);

  const message =
    status === "failed"
      ? (errorMessage ?? "인증 결과를 처리하지 못했습니다. 처음 화면에서 다시 시도해 주세요.")
      : status === "sent"
        ? "인증이 완료되었습니다. 잠시 후 이동합니다."
        : status === "processing"
          ? "인증 결과를 확인하는 중입니다."
          : "인증 결과를 전달하는 중입니다.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md space-y-3">
        <p
          className={`text-center text-sm font-medium ${
            status === "failed" ? "text-red-600" : "text-muted-foreground"
          }`}
          role={status === "failed" ? "alert" : undefined}
        >
          {message}
        </p>
      </div>
    </main>
  );
}
