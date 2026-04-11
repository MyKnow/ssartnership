"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import {
  getPartnerPortalPasswordResetErrorMessage,
} from "@/lib/partner-password-errors";

type SuccessState = {
  emailSentTo: string;
  temporaryPassword?: string | null;
};

export default function PartnerPasswordResetForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const { notify } = useToast();

  const handleReset = async () => {
    if (pending) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("담당자 이메일을 입력해 주세요.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("이메일 형식이 올바르지 않습니다.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/partner/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizePartnerLoginId(trimmedEmail) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? getPartnerPortalPasswordResetErrorMessage(
                data.error as Parameters<typeof getPartnerPortalPasswordResetErrorMessage>[0],
              )
            : "비밀번호 재설정에 실패했습니다.";
        setError(message);
        notify(message);
        return;
      }

      const temporaryPassword =
        typeof data.temporaryPassword === "string"
          ? data.temporaryPassword
          : null;

      setError(null);
      setSuccess({
        emailSentTo:
          typeof data.emailSentTo === "string"
            ? data.emailSentTo
            : normalizePartnerLoginId(trimmedEmail),
        temporaryPassword,
      });
      notify("임시 비밀번호 안내를 보냈습니다.");
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <p className="text-sm font-medium text-foreground">
            {success.emailSentTo}로 임시 비밀번호를 보냈습니다.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            이메일을 확인한 뒤, 임시 비밀번호로 로그인하세요.
            로그인 후에는 반드시 새 비밀번호로 변경해야 합니다.
          </p>
          {success.temporaryPassword ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                임시 비밀번호
              </p>
              <p className="mt-2 font-mono text-sm text-foreground">
                {success.temporaryPassword}
              </p>
            </div>
          ) : null}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button href="/partner/login">로그인 페이지</Button>
          <Button variant="ghost" href="/partner/reset">
            다시 발급
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        담당자 이메일
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="partner@example.com"
          autoComplete="email"
          inputMode="email"
          disabled={pending}
        />
      </label>

      <FormMessage>
        초기 설정이 완료된 계정이라면, 등록된 이메일로 임시 비밀번호가
        전송됩니다.
      </FormMessage>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}

      <Button
        onClick={handleReset}
        loading={pending}
        loadingText="임시 비밀번호 발급 중"
      >
        임시 비밀번호 받기
      </Button>
    </div>
  );
}
