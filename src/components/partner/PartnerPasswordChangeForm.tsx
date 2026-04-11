"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";
import {
  getPartnerPortalPasswordChangeErrorMessage,
} from "@/lib/partner-password-errors";

export default function PartnerPasswordChangeForm({
  mustChangePassword,
}: {
  mustChangePassword: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();
  const router = useRouter();

  const handleSubmit = async () => {
    if (pending) {
      return;
    }
    if (!currentPassword || !nextPassword) {
      setError("현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/partner/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? getPartnerPortalPasswordChangeErrorMessage(
                data.error as Parameters<typeof getPartnerPortalPasswordChangeErrorMessage>[0],
              )
            : "비밀번호 변경에 실패했습니다.";
        setError(message);
        notify(message);
        return;
      }

      setError(null);
      notify("비밀번호가 변경되었습니다.");
      router.replace("/partner");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {mustChangePassword ? (
        <FormMessage>
          임시 비밀번호로 로그인한 상태입니다. 지금 새 비밀번호를 설정해야
          계속 이용할 수 있습니다.
        </FormMessage>
      ) : null}

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        현재 비밀번호
        <PasswordInput
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="현재 비밀번호"
          autoComplete="current-password"
          disabled={pending}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        새 비밀번호
        <PasswordInput
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          autoComplete="new-password"
          disabled={pending}
        />
      </label>

      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>

      <Button
        onClick={handleSubmit}
        loading={pending}
        loadingText="변경 중"
      >
        비밀번호 변경
      </Button>
    </div>
  );
}
