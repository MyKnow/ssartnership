"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { sanitizeReturnTo } from "@/lib/return-to";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export default function LoginForm({
  returnTo,
}: {
  returnTo?: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
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
      return;
    }
    const alreadyRegisteredFlag = sessionStorage.getItem("signup:alreadyRegistered");
    if (alreadyRegisteredFlag) {
      sessionStorage.removeItem("signup:alreadyRegistered");
      notify("이미 가입된 사용자입니다. 로그인해 주세요.");
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
      const normalizedUsername = normalizeMmUsername(username);
      const response = await fetch("/api/mm/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
          autoLogin,
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
      const safeReturnTo = sanitizeReturnTo(returnTo, "/");
      const nextHref = data.requiresConsent
        ? `/auth/consent?returnTo=${encodeURIComponent(safeReturnTo)}`
        : safeReturnTo;
      router.replace(nextHref);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleLogin();
      }}
    >
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        아이디
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
        비밀번호
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

      <div className="flex min-w-0 items-center justify-between gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={autoLogin}
            onChange={(event) => setAutoLogin(event.target.checked)}
            className="h-5 w-5 rounded border-border bg-surface-control text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          자동 로그인
        </label>
        <Link
          href="/auth/reset"
          className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          비밀번호 재설정
        </Link>
      </div>

      <Button type="submit" loading={pending} loadingText="로그인 중">
        로그인
      </Button>

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}
    </form>
  );
}
