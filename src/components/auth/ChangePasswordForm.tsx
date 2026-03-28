"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/ui/PasswordInput";
import FormMessage from "@/components/ui/FormMessage";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();

  const handleChange = async () => {
    if (pending) {
      return;
    }
    if (!current || !nextPassword) {
      setError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/mm/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, nextPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "invalid_password") {
          setError(PASSWORD_POLICY_MESSAGE);
          return;
        }
        if (data.error === "wrong_password") {
          setError("현재 비밀번호가 올바르지 않습니다.");
          return;
        }
        setError("비밀번호 변경에 실패했습니다.");
        return;
      }
      setError(null);
      notify("비밀번호가 변경되었습니다.");
      router.replace("/certification");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        현재 비밀번호
        <PasswordInput
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          placeholder="현재 비밀번호"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        새 비밀번호
        <PasswordInput
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          required
        />
      </label>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>
      <Button onClick={handleChange} disabled={pending}>
        비밀번호 변경
      </Button>
    </div>
  );
}
