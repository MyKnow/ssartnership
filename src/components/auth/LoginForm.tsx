"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/ui/PasswordInput";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import FormMessage from "@/components/ui/FormMessage";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flag = sessionStorage.getItem("reset:success");
    if (flag) {
      sessionStorage.removeItem("reset:success");
      notify("임시 비밀번호가 발급되었습니다. 로그인해 주세요.");
    }
  }, [notify]);

  const handleLogin = async () => {
    if (pending) {
      return;
    }
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    const usernameError = validateMmUsername(username, "아이디");
    if (usernameError) {
      setError(usernameError);
      return;
    }
    setPending(true);
    const normalizedUsername = normalizeMmUsername(username);
    try {
      const response = await fetch("/api/mm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "blocked") {
          setError("로그인이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.");
          notify("로그인이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        notify("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      setError(null);
      notify("로그인되었습니다.");
      router.replace(data.requiresConsent ? "/auth/consent" : "/");
    } finally {
      setPending(false);
    }
  };


  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <MmUsernameInput
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        사이트 비밀번호
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="사이트 비밀번호"
          required
        />
      </label>
      <Button onClick={handleLogin} loading={pending} loadingText="로그인 중">
        로그인
      </Button>
      <Button variant="ghost" href="/auth/reset">
        비밀번호 재설정
      </Button>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
    </div>
  );
}
