"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flag = sessionStorage.getItem("reset:success");
    if (flag) {
      sessionStorage.removeItem("reset:success");
      notify("비밀번호가 재설정되었습니다. 로그인해 주세요.");
      return;
    }
    const signupFlag = sessionStorage.getItem("signup:success");
    if (signupFlag) {
      sessionStorage.removeItem("signup:success");
      notify("회원가입이 완료되었습니다.");
    }
  }, [notify]);

  function clearFieldError(field: "username" | "password") {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  }

  const handleLogin = async () => {
    if (pending) {
      return;
    }

    if (!username.trim() || !password) {
      setFieldErrors({
        username: username.trim() ? undefined : "아이디를 입력해 주세요.",
        password: password ? undefined : "비밀번호를 입력해 주세요.",
      });
      setFormError(null);
      focusField(username.trim() ? passwordRef : usernameRef);
      return;
    }

    const usernameError = validateMmUsername(username, "아이디");
    if (usernameError) {
      setFieldErrors({ username: usernameError });
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const response = await fetch("/api/mm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          password,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "blocked") {
          setFormError("로그인이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setFormError("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      setFieldErrors({});
      setFormError(null);
      notify("로그인되었습니다.");
      router.replace(data.requiresConsent ? "/auth/consent" : "/");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <MmUsernameInput
          ref={usernameRef}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            clearFieldError("username");
          }}
          aria-invalid={Boolean(fieldErrors.username) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.username))}
        />
        {fieldErrors.username ? (
          <FormMessage variant="error">{fieldErrors.username}</FormMessage>
        ) : null}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        사이트 비밀번호
        <PasswordInput
          ref={passwordRef}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearFieldError("password");
          }}
          placeholder="사이트 비밀번호"
          required
          aria-invalid={Boolean(fieldErrors.password) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.password))}
        />
        {fieldErrors.password ? (
          <FormMessage variant="error">{fieldErrors.password}</FormMessage>
        ) : null}
      </label>

      <Button onClick={handleLogin} loading={pending} loadingText="로그인 중">
        로그인
      </Button>
      <Button variant="ghost" href="/auth/reset">
        비밀번호 재설정
      </Button>

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}
    </div>
  );
}
