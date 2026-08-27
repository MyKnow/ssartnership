"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { getMemberRequiredGateRedirect } from "@/lib/member-required-gates";
import {
  persistLastMemberLoginMethod,
  readLastMemberLoginMethod,
  type MemberLoginMethod,
} from "@/lib/member-login-method-preference.client";
import { sanitizeReturnTo } from "@/lib/return-to";
import { isValidEmail, normalizeMmUsername, validateMmUsername } from "@/lib/validation";

const loginMethods: MemberLoginMethod[] = ["username", "email"];

function loginMethodTabClassName(active: boolean) {
  return active
    ? "min-h-11 rounded-[0.95rem] bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-raised"
    : "min-h-11 rounded-[0.95rem] px-3 text-sm font-semibold text-foreground transition hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
}

export default function LoginForm({
  returnTo,
}: {
  returnTo?: string;
}) {
  const [loginMethod, setLoginMethod] = useState<MemberLoginMethod>("username");
  const [identifiers, setIdentifiers] = useState<Record<MemberLoginMethod, string>>({
    username: "",
    email: "",
  });
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
  const id = useId();
  const usernameTabId = `${id}-username-tab`;
  const emailTabId = `${id}-email-tab`;
  const usernamePanelId = `${id}-username-panel`;
  const emailPanelId = `${id}-email-panel`;
  const usernameIdentifierRef = useRef<HTMLInputElement>(null);
  const emailIdentifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const identifier = identifiers[loginMethod];
  const identifierLabel = loginMethod === "email" ? "이메일" : "Mattermost 아이디";

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
      notify("이미 가입된 회원입니다.");
    }
  }, [notify]);

  useEffect(() => {
    setLoginMethod(readLastMemberLoginMethod());
  }, []);

  function getIdentifierRef(method: MemberLoginMethod) {
    return method === "email" ? emailIdentifierRef : usernameIdentifierRef;
  }

  function selectLoginMethod(method: MemberLoginMethod) {
    if (pending || method === loginMethod) {
      return;
    }
    setLoginMethod(method);
    setFieldErrors((previous) => ({ ...previous, identifier: undefined }));
    setFormError(null);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentMethod: MemberLoginMethod,
  ) {
    const currentIndex = loginMethods.indexOf(currentMethod);
    const nextIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % loginMethods.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + loginMethods.length) % loginMethods.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? loginMethods.length - 1
              : null;

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextMethod = loginMethods[nextIndex];
    selectLoginMethod(nextMethod);
    document
      .getElementById(nextMethod === "email" ? emailTabId : usernameTabId)
      ?.focus();
  }

  function clearFieldError(field: "identifier" | "password") {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  }

  const handleLogin = async () => {
    if (pending) {
      return;
    }

    if (!identifier.trim() || !password) {
      setFieldErrors({
        identifier: identifier.trim() ? undefined : `${identifierLabel}를 입력해 주세요.`,
        password: password ? undefined : "비밀번호를 입력해 주세요.",
      });
      setFormError(null);
      focusField(identifier.trim() ? passwordRef : getIdentifierRef(loginMethod));
      return;
    }

    const identifierValue = identifier.trim();
    const identifierError = loginMethod === "email"
      ? isValidEmail(identifierValue)
        ? null
        : "이메일 주소를 확인해 주세요."
      : validateMmUsername(identifierValue, "Mattermost 아이디");
    if (identifierError) {
      setFieldErrors({ identifier: identifierError });
      setFormError(null);
      focusField(getIdentifierRef(loginMethod));
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const normalizedLoginIdentifier = loginMethod === "email"
        ? identifierValue.toLowerCase()
        : normalizeMmUsername(identifierValue);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: normalizedLoginIdentifier,
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
        setFormError(`${identifierLabel} 또는 비밀번호가 올바르지 않습니다.`);
        return;
      }

      setFieldErrors({});
      setFormError(null);
      persistLastMemberLoginMethod(loginMethod);
      notify("로그인되었습니다.");
      const safeReturnTo = sanitizeReturnTo(returnTo, "/");
      const nextHref =
        getMemberRequiredGateRedirect({
          currentPath: "/auth/login",
          returnTo: safeReturnTo,
          mustChangePassword: Boolean(data.mustChangePassword),
          requiresConsent: Boolean(data.requiresConsent),
          requiresProfilePhotoUpdate: Boolean(data.requiresProfilePhotoUpdate),
        }) ?? safeReturnTo;
      router.replace(nextHref);
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
      <div
        role="tablist"
        aria-label="로그인 방식"
        className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-border bg-surface-inset p-2"
      >
        <button
          id={usernameTabId}
          type="button"
          role="tab"
          aria-selected={loginMethod === "username"}
          aria-controls={usernamePanelId}
          tabIndex={loginMethod === "username" ? 0 : -1}
          disabled={pending}
          onClick={() => selectLoginMethod("username")}
          onKeyDown={(event) => handleTabKeyDown(event, "username")}
          className={loginMethodTabClassName(loginMethod === "username")}
        >
          아이디
        </button>
        <button
          id={emailTabId}
          type="button"
          role="tab"
          aria-selected={loginMethod === "email"}
          aria-controls={emailPanelId}
          tabIndex={loginMethod === "email" ? 0 : -1}
          disabled={pending}
          onClick={() => selectLoginMethod("email")}
          onKeyDown={(event) => handleTabKeyDown(event, "email")}
          className={loginMethodTabClassName(loginMethod === "email")}
        >
          이메일
        </button>
      </div>

      {loginMethods.map((method) => {
        const isEmail = method === "email";
        const active = loginMethod === method;
        return (
          <section
            key={method}
            id={isEmail ? emailPanelId : usernamePanelId}
            role="tabpanel"
            aria-labelledby={isEmail ? emailTabId : usernameTabId}
            hidden={!active}
          >
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              {isEmail ? "이메일" : "Mattermost 아이디"}
              <Input
                ref={isEmail ? emailIdentifierRef : usernameIdentifierRef}
                type={isEmail ? "email" : "text"}
                inputMode={isEmail ? "email" : "text"}
                autoComplete="username"
                placeholder={isEmail ? "예시: myknow@example.com" : "예시: myknow"}
                value={identifiers[method]}
                onChange={(event) => {
                  setIdentifiers((previous) => ({
                    ...previous,
                    [method]: event.target.value,
                  }));
                  clearFieldError("identifier");
                }}
                aria-invalid={(active && Boolean(fieldErrors.identifier)) || undefined}
                className={getFieldErrorClass(active && Boolean(fieldErrors.identifier))}
              />
              {active && fieldErrors.identifier ? (
                <FormMessage variant="error">{fieldErrors.identifier}</FormMessage>
              ) : null}
            </label>
          </section>
        );
      })}

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
