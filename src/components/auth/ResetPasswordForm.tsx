"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function ResetPasswordForm() {
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const handleReset = async () => {
    if (pending) {
      return;
    }
    if (!username) {
      setError("MM 아이디를 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/mm/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "cooldown") {
          setError("재설정 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "blocked") {
          setError("재설정 요청이 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "not_registered") {
          setError("등록된 계정을 찾을 수 없습니다.");
          return;
        }
        if (data.error === "not_mm") {
          setError("해당 아이디는 교육생 채널에 존재하지 않습니다.");
          return;
        }
        setError("비밀번호 재설정에 실패했습니다.");
        return;
      }
      setError(null);
      notify("임시 비밀번호가 MM DM으로 전송되었습니다.");
      sessionStorage.setItem("reset:success", "1");
      window.location.href = "/auth/login";
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="myknow"
          required
        />
      </label>
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Button onClick={handleReset} disabled={pending}>
        임시 비밀번호 발급
      </Button>
    </div>
  );
}
