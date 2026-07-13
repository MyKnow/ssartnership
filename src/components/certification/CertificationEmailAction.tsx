"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Surface from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";
import { isValidEmail } from "@/lib/validation";

type MemberEmailResponse = {
  ok?: boolean;
  alreadyVerified?: boolean;
  message?: string;
};

function getErrorMessage(payload: MemberEmailResponse | null) {
  return payload?.message?.trim() || "이메일 인증을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function CertificationEmailAction({
  initialEmail,
  emailVerified,
}: {
  initialEmail?: string | null;
  emailVerified?: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setEmail(initialEmail ?? "");
  }, [initialEmail]);

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      notify("이메일 주소를 확인해 주세요.");
      return;
    }

    setSending(true);
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
        notify(getErrorMessage(payload));
        return;
      }
      if (payload.alreadyVerified) {
        notify("현재 이메일은 이미 인증되어 이메일 로그인에 사용할 수 있습니다.");
        return;
      }
      setCode("");
      setCodeSent(true);
      notify("인증 코드를 보냈습니다. 10분 안에 입력해 주세요.");
    } catch {
      notify("인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(code)) {
      notify("이메일과 6자리 인증 코드를 확인해 주세요.");
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch("/api/member/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as MemberEmailResponse | null;
      if (!response.ok || !payload?.ok) {
        notify(getErrorMessage(payload));
        return;
      }
      setCode("");
      setCodeSent(false);
      notify("이메일 인증이 완료되었습니다. 이제 이메일로 로그인할 수 있습니다.");
      router.refresh();
    } catch {
      notify("이메일 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Surface level="inset" padding="lg" className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">로그인 이메일</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            인증을 마치면 Mattermost 아이디 대신 이메일로도 로그인할 수 있습니다.
          </p>
        </div>
        <span
          className={
            emailVerified
              ? "shrink-0 text-xs font-semibold text-success"
              : "shrink-0 text-xs font-semibold text-muted-foreground"
          }
        >
          {emailVerified ? "인증 완료" : "미인증"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
          이메일
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setCodeSent(false);
              setCode("");
            }}
            placeholder="name@example.com"
            disabled={sending || verifying}
          />
        </label>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          loading={sending}
          loadingText="전송 중"
          onClick={requestCode}
        >
          {emailVerified ? "변경 코드 보내기" : "인증 코드 보내기"}
        </Button>
      </div>
      {codeSent ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
            6자리 인증 코드
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              disabled={verifying}
            />
          </label>
          <Button
            className="w-full sm:w-auto"
            loading={verifying}
            loadingText="확인 중"
            onClick={verifyCode}
          >
            이메일 인증하기
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
