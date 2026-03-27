"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();

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
          setError("비밀번호 정책에 맞지 않습니다.");
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
      window.location.href = "/certification";
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        현재 비밀번호
        <Input
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          placeholder="현재 비밀번호"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        새 비밀번호
        <Input
          type="password"
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          required
        />
      </label>
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Button onClick={handleChange} disabled={pending}>
        비밀번호 변경
      </Button>
    </div>
  );
}
