"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import Surface from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";
import {
  formatMemberEmailRemainingTime,
  getMemberEmailDeadline,
  getMemberEmailRemainingSeconds,
  MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS,
  MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS,
  resolveMemberEmailDeadline,
} from "@/lib/member-email-verification-timing";
import { isValidEmail } from "@/lib/validation";

type MemberEmailResponse = {
  ok?: boolean;
  alreadyVerified?: boolean;
  code?: string;
  message?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  resendAvailableAt?: string;
  resendAvailableInSeconds?: number;
  retryAfterSeconds?: number;
};

function getErrorMessage(payload: MemberEmailResponse | null) {
  return (
    payload?.message?.trim() ||
    "이메일 인증을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
  );
}

export default function MemberEmailVerificationView({
  initialEmail,
  emailVerified,
  completionHref,
}: {
  initialEmail?: string | null;
  emailVerified?: boolean;
  completionHref: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const codeRemainingSeconds = getMemberEmailRemainingSeconds(
    codeExpiresAt,
    now,
  );
  const resendRemainingSeconds = getMemberEmailRemainingSeconds(
    resendAvailableAt,
    now,
  );
  const hasCompleteCode = /^\d{6}$/.test(code);
  const hasValidEmail = isValidEmail(email.trim().toLowerCase());
  const currentStep = lockedEmail ? 2 : 1;

  useEffect(() => {
    if (codeExpiresAt === null && resendAvailableAt === null) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      const codeFinished = codeExpiresAt === null || codeExpiresAt <= nextNow;
      const resendFinished =
        resendAvailableAt === null || resendAvailableAt <= nextNow;
      if (codeFinished && resendFinished) {
        window.clearInterval(timer);
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [codeExpiresAt, resendAvailableAt]);

  const requestCode = async () => {
    if (sending || verifying || resendRemainingSeconds > 0) {
      return;
    }
    const normalizedEmail = (lockedEmail ?? email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage("이메일 주소를 확인해 주세요.");
      emailInputRef.current?.focus();
      return;
    }

    setSending(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/member/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as MemberEmailResponse | null;

      if (!response.ok || !payload?.ok) {
        if (
          payload?.code === "resend_cooldown" &&
          typeof payload.retryAfterSeconds === "number"
        ) {
          const requestTime = Date.now();
          setNow(requestTime);
          setResendAvailableAt(
            getMemberEmailDeadline(
              payload.retryAfterSeconds,
              MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS,
              requestTime,
            ),
          );
        }
        setErrorMessage(getErrorMessage(payload));
        return;
      }
      if (payload.alreadyVerified) {
        notify("현재 이메일은 이미 인증되어 있습니다.");
        router.replace(completionHref);
        return;
      }

      const requestTime = Date.now();
      setEmail(normalizedEmail);
      setLockedEmail(normalizedEmail);
      setCode("");
      setNow(requestTime);
      setCodeExpiresAt(
        resolveMemberEmailDeadline(
          payload.expiresAt,
          payload.expiresInSeconds,
          MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS,
          requestTime,
        ),
      );
      setResendAvailableAt(
        resolveMemberEmailDeadline(
          payload.resendAvailableAt,
          payload.resendAvailableInSeconds,
          MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS,
          requestTime,
        ),
      );
      notify("인증 코드를 보냈습니다. 10분 안에 입력해 주세요.");
      window.setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch {
      setErrorMessage(
        "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (verifying || sending || !lockedEmail) {
      return;
    }
    if (codeRemainingSeconds === 0) {
      setErrorMessage(
        "인증 코드의 유효시간이 끝났습니다. 새 코드를 받아 주세요.",
      );
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage("6자리 인증 코드를 확인해 주세요.");
      codeInputRef.current?.focus();
      return;
    }

    setVerifying(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/member/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lockedEmail, code }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as MemberEmailResponse | null;
      if (!response.ok || !payload?.ok) {
        setErrorMessage(getErrorMessage(payload));
        codeInputRef.current?.focus();
        return;
      }

      notify(
        "이메일 인증이 완료되었습니다. 로그인과 비밀번호 재설정에 사용할 수 있습니다.",
      );
      router.replace(completionHref);
    } catch {
      setErrorMessage(
        "이메일 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const editAnotherEmail = () => {
    setLockedEmail(null);
    setCode("");
    setCodeExpiresAt(null);
    setErrorMessage(null);
    window.setTimeout(() => emailInputRef.current?.focus(), 0);
  };

  return (
    <Surface level="elevated" padding="lg" className="space-y-6">
      <div>
        <nav aria-label={`인증 단계 ${currentStep}/2`}>
          <ol className="grid grid-cols-2 gap-1.5">
            {[1, 2].map((step) => (
              <li
                key={step}
                aria-current={step === currentStep ? "step" : undefined}
              >
                <span className="sr-only">
                  {step}단계 {step === 1 ? "이메일 입력" : "인증 코드 입력"}
                </span>
                <span
                  aria-hidden="true"
                  className={`block h-1 rounded-full ${
                    step <= currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              </li>
            ))}
          </ol>
        </nav>
        <p className="ui-kicker mt-3">{currentStep}단계</p>
        <h2 className="mt-2 text-lg font-semibold text-foreground">
          {lockedEmail
            ? "이메일로 받은 코드를 입력해 주세요"
            : emailVerified
              ? "변경할 이메일을 입력해 주세요"
              : "사용할 이메일을 입력해 주세요"}
        </h2>
      </div>

      {lockedEmail ? (
        <div className="space-y-5">
          <div className="rounded-[1.25rem] border border-border bg-surface-inset px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  인증 코드를 보낸 이메일
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-foreground">
                  {lockedEmail}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                ariaLabel="다른 이메일 입력"
                title="다른 이메일 입력"
                disabled={sending || verifying}
                onClick={editAnotherEmail}
              >
                <Pencil aria-hidden="true" size={18} />
              </Button>
            </div>
          </div>

          {codeRemainingSeconds === 0 ? (
            <InlineMessage
              tone="warning"
              title="인증 코드 만료"
              description="유효시간이 끝났습니다. 같은 이메일로 새 인증 코드를 받아 주세요."
              role="status"
            />
          ) : null}

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode();
            }}
          >
            <label className="grid gap-2 text-sm font-medium text-foreground">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>6자리 인증 코드</span>
                <span
                  role="timer"
                  aria-label={`인증 코드 유효시간 ${formatMemberEmailRemainingTime(codeRemainingSeconds)}`}
                  className={
                    codeRemainingSeconds === 0
                      ? "font-semibold tabular-nums text-danger"
                      : "font-semibold tabular-nums text-primary"
                  }
                >
                  {formatMemberEmailRemainingTime(codeRemainingSeconds)}
                </span>
              </span>
              <div className="flex items-stretch gap-2">
                <Input
                  ref={codeInputRef}
                  className="min-w-0 flex-1"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ""));
                    setErrorMessage(null);
                  }}
                  placeholder="000000"
                  disabled={verifying || sending || codeRemainingSeconds === 0}
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={
                    errorMessage ? "member-email-error" : undefined
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-3"
                  loading={sending}
                  loadingText="전송 중"
                  disabled={verifying || resendRemainingSeconds > 0}
                  onClick={() => void requestCode()}
                >
                  {resendRemainingSeconds > 0
                    ? `재전송 ${resendRemainingSeconds}초`
                    : "재전송"}
                </Button>
              </div>
            </label>

            {errorMessage ? (
              <FormMessage id="member-email-error" variant="error">
                {errorMessage}
              </FormMessage>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              loading={verifying}
              loadingText="확인 중"
              disabled={
                sending || codeRemainingSeconds === 0 || !hasCompleteCode
              }
            >
              이메일 인증 완료하기
            </Button>
          </form>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void requestCode();
          }}
        >
          <label className="grid gap-2 text-sm font-medium text-foreground">
            이메일
            <Input
              ref={emailInputRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage(null);
              }}
              placeholder="name@example.com"
              disabled={sending || verifying}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "member-email-error" : undefined}
            />
          </label>

          {errorMessage ? (
            <FormMessage id="member-email-error" variant="error">
              {errorMessage}
            </FormMessage>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            loading={sending}
            loadingText="인증 코드 전송 중"
            disabled={
              verifying || resendRemainingSeconds > 0 || !hasValidEmail
            }
          >
            {resendRemainingSeconds > 0
              ? `${resendRemainingSeconds}초 후 다시 요청`
              : "인증 코드 보내기"}
          </Button>
        </form>
      )}
    </Surface>
  );
}
