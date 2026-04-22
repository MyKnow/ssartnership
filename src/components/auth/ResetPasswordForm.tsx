"use client";

import { useRef, useState } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { generateTempPassword, isValidPassword } from "@/lib/password";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";

type Step = 1 | 2 | 3;

export default function ResetPasswordForm() {
  const [step, setStep] = useState<Step>(1);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState("");
  const [pendingRequest, setPendingRequest] = useState(false);
  const [pendingVerify, setPendingVerify] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    code?: string;
    nextPassword?: string;
    nextPasswordConfirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { notify } = useToast();
  const usernameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const nextPasswordRef = useRef<HTMLInputElement>(null);
  const nextPasswordConfirmRef = useRef<HTMLInputElement>(null);

  function resetFieldErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  function resetToCodeStep() {
    setStep(2);
    setCode("");
    setNextPassword("");
    setNextPasswordConfirm("");
    resetFieldErrors();
    window.setTimeout(() => focusField(codeRef), 0);
  }

  function resetToPasswordStep() {
    setStep(3);
    setNextPassword("");
    setNextPasswordConfirm("");
    setFieldErrors((prev) => ({
      ...prev,
      nextPassword: undefined,
      nextPasswordConfirm: undefined,
    }));
    setFormError(null);
    window.setTimeout(() => focusField(nextPasswordRef), 0);
  }

  async function handleRequestCode() {
    if (pendingRequest) {
      return;
    }

    if (!username.trim()) {
      setFieldErrors({ username: "MM 아이디를 입력해 주세요." });
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    const usernameError = validateMmUsername(username);
    if (usernameError) {
      setFieldErrors({ username: usernameError });
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    setPendingRequest(true);
    setFieldErrors((prev) => ({ ...prev, username: undefined }));
    setFormError(null);

    try {
      const response = await fetch("/api/mm/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizeMmUsername(username) }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "invalid_username") {
          setFieldErrors({ username: "MM 아이디 형식을 확인해 주세요." });
          focusField(usernameRef);
          return;
        }
        if (data.error === "cooldown") {
          setFormError("인증번호 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "blocked") {
          setFormError("인증번호 요청이 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "not_registered") {
          setFormError("등록된 회원 정보가 없습니다.");
          return;
        }
        setFormError("인증번호 발급에 실패했습니다.");
        return;
      }

      notify("인증번호가 MM DM으로 전송되었습니다.");
      resetToCodeStep();
    } finally {
      setPendingRequest(false);
    }
  }

  async function handleVerifyCode() {
    if (pendingVerify) {
      return;
    }

    if (!username.trim()) {
      setFieldErrors({ username: "MM 아이디를 입력해 주세요." });
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    if (!code.trim()) {
      setFieldErrors({ code: "인증번호를 입력해 주세요." });
      setFormError(null);
      focusField(codeRef);
      return;
    }

    setPendingVerify(true);
    setFieldErrors((prev) => ({ ...prev, code: undefined }));
    setFormError(null);

    try {
      const response = await fetch("/api/mm/reset-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          code: code.trim().toUpperCase(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "invalid_username") {
          setFieldErrors({ username: "MM 아이디 형식을 확인해 주세요." });
          focusField(usernameRef);
          return;
        }
        if (data.error === "invalid_code") {
          setFieldErrors({ code: "인증번호가 올바르지 않습니다." });
          focusField(codeRef);
          return;
        }
        if (data.error === "expired") {
          setFormError("인증번호가 만료되었습니다. 다시 발급해 주세요.");
          returnToRequest();
          return;
        }
        if (data.error === "blocked") {
          setFormError("인증번호 확인이 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setFormError("인증번호 확인에 실패했습니다.");
        return;
      }

      notify("인증번호가 확인되었습니다.");
      resetToPasswordStep();
    } finally {
      setPendingVerify(false);
    }
  }

  function returnToRequest() {
    setStep(1);
    setCode("");
    setNextPassword("");
    setNextPasswordConfirm("");
    setFieldErrors((prev) => ({
      ...prev,
      code: undefined,
      nextPassword: undefined,
      nextPasswordConfirm: undefined,
    }));
    window.setTimeout(() => focusField(usernameRef), 0);
  }

  async function handleGeneratePassword() {
    const generated = generateTempPassword(12);
    setNextPassword(generated);
    setNextPasswordConfirm(generated);
    setFieldErrors((prev) => ({
      ...prev,
      nextPassword: undefined,
      nextPasswordConfirm: undefined,
    }));
    setFormError(null);

    try {
      await navigator.clipboard.writeText(generated);
      notify("랜덤 비밀번호가 생성되어 복사되었습니다.");
    } catch {
      notify("랜덤 비밀번호가 생성되었습니다.");
    }
  }

  async function handleComplete() {
    if (pendingComplete) {
      return;
    }

    if (!username.trim()) {
      setFieldErrors({ username: "MM 아이디를 입력해 주세요." });
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    if (!code.trim()) {
      setFieldErrors({ code: "인증번호를 입력해 주세요." });
      setFormError(null);
      focusField(codeRef);
      return;
    }

    if (!nextPassword || !nextPasswordConfirm) {
      setFieldErrors({
        nextPassword: nextPassword ? undefined : "새 비밀번호를 입력해 주세요.",
        nextPasswordConfirm: nextPasswordConfirm
          ? undefined
          : "비밀번호를 한 번 더 입력해 주세요.",
      });
      setFormError(null);
      focusField(nextPassword ? nextPasswordConfirmRef : nextPasswordRef);
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setFieldErrors({
        nextPasswordConfirm: "비밀번호가 서로 일치하지 않습니다.",
      });
      setFormError(null);
      focusField(nextPasswordConfirmRef);
      return;
    }

    if (!isValidPassword(nextPassword)) {
      setFieldErrors({ nextPassword: PASSWORD_POLICY_MESSAGE });
      setFormError(null);
      focusField(nextPasswordRef);
      return;
    }

    setPendingComplete(true);
    setFormError(null);

    try {
      const response = await fetch("/api/mm/reset-password/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          code: code.trim().toUpperCase(),
          nextPassword,
          nextPasswordConfirm,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "invalid_password") {
          setFieldErrors({ nextPassword: PASSWORD_POLICY_MESSAGE });
          focusField(nextPasswordRef);
          return;
        }
        if (data.error === "password_mismatch") {
          setFieldErrors({
            nextPasswordConfirm: "비밀번호가 서로 일치하지 않습니다.",
          });
          focusField(nextPasswordConfirmRef);
          return;
        }
        if (data.error === "invalid_code") {
          setFormError("인증번호가 올바르지 않습니다. 다시 확인해 주세요.");
          returnToCodeStep();
          return;
        }
        if (data.error === "expired") {
          setFormError("인증번호가 만료되었습니다. 다시 발급해 주세요.");
          returnToRequest();
          return;
        }
        if (data.error === "blocked") {
          setFormError("재설정 시도가 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setFormError("비밀번호 재설정에 실패했습니다.");
        return;
      }

      notify("비밀번호가 재설정되었습니다.");
      sessionStorage.setItem("reset:success", "1");
      window.location.replace("/auth/login");
    } finally {
      setPendingComplete(false);
    }
  }

  function returnToCodeStep() {
    setStep(2);
    setNextPassword("");
    setNextPasswordConfirm("");
    setFieldErrors((prev) => ({
      ...prev,
      nextPassword: undefined,
      nextPasswordConfirm: undefined,
    }));
    window.setTimeout(() => focusField(codeRef), 0);
  }

  const requestLoading = pendingRequest;
  const verifyLoading = pendingVerify;
  const completeLoading = pendingComplete;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section className="rounded-2xl border border-border/70 bg-surface-inset p-4 shadow-[var(--shadow-flat)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">1. 인증번호 발급</h2>
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={returnToRequest}>
                다시 입력
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            가입된 MM 아이디로 인증번호를 발급받습니다.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            MM 아이디
            <MmUsernameInput
              ref={usernameRef}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setFieldErrors((prev) => ({ ...prev, username: undefined }));
                setFormError(null);
              }}
              disabled={step > 1}
              aria-invalid={Boolean(fieldErrors.username) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.username))}
            />
            {fieldErrors.username ? (
              <FormMessage variant="error">{fieldErrors.username}</FormMessage>
            ) : null}
          </label>

          <div className="flex justify-end">
            <Button
              onClick={handleRequestCode}
              loading={requestLoading}
              loadingText="인증번호 발급 중"
              variant="secondary"
            >
              인증번호 발급
            </Button>
          </div>
        </div>
      </section>

      {step >= 2 ? (
        <section className="rounded-2xl border border-border/70 bg-surface-inset p-4 shadow-[var(--shadow-flat)]">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">2. 인증번호 확인</h2>
            <p className="text-sm text-muted-foreground">
              MM DM으로 받은 인증번호를 입력해 주세요.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              인증번호
              <Input
                ref={codeRef}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  setFieldErrors((prev) => ({ ...prev, code: undefined }));
                  setFormError(null);
                }}
                placeholder="예: A1B2C3"
                inputMode="text"
                autoComplete="one-time-code"
                required
                aria-invalid={Boolean(fieldErrors.code) || undefined}
                className={getFieldErrorClass(Boolean(fieldErrors.code))}
              />
              {fieldErrors.code ? (
                <FormMessage variant="error">{fieldErrors.code}</FormMessage>
              ) : null}
            </label>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={returnToRequest}
              >
                요청 다시하기
              </Button>
              <Button
                onClick={handleVerifyCode}
                loading={verifyLoading}
                loadingText="확인 중"
                variant="secondary"
              >
                인증번호 확인
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-border/70 bg-surface-inset p-4 shadow-[var(--shadow-flat)]">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">3. 새 비밀번호 설정</h2>
            <p className="text-sm text-muted-foreground">
              새 비밀번호를 두 번 입력한 뒤 재설정을 완료합니다.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium text-foreground">
                새 비밀번호
                <PasswordInput
                  ref={nextPasswordRef}
                  value={nextPassword}
                  onChange={(event) => {
                    setNextPassword(event.target.value);
                    setFieldErrors((prev) => ({
                      ...prev,
                      nextPassword: undefined,
                    }));
                    setFormError(null);
                  }}
                  placeholder="영문/숫자/특수문자 포함 8자 이상"
                  required
                  aria-invalid={Boolean(fieldErrors.nextPassword) || undefined}
                  className={getFieldErrorClass(Boolean(fieldErrors.nextPassword))}
                />
                {fieldErrors.nextPassword ? (
                  <FormMessage variant="error">
                    {fieldErrors.nextPassword}
                  </FormMessage>
                ) : null}
              </label>

              <Button
                variant="secondary"
                onClick={handleGeneratePassword}
                className="shrink-0"
              >
                랜덤 생성
              </Button>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              비밀번호 확인
              <PasswordInput
                ref={nextPasswordConfirmRef}
                value={nextPasswordConfirm}
                onChange={(event) => {
                  setNextPasswordConfirm(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    nextPasswordConfirm: undefined,
                  }));
                  setFormError(null);
                }}
                placeholder="비밀번호를 한 번 더 입력해 주세요."
                required
                aria-invalid={
                  Boolean(fieldErrors.nextPasswordConfirm) || undefined
                }
                className={getFieldErrorClass(
                  Boolean(fieldErrors.nextPasswordConfirm),
                )}
              />
              {fieldErrors.nextPasswordConfirm ? (
                <FormMessage variant="error">
                  {fieldErrors.nextPasswordConfirm}
                </FormMessage>
              ) : null}
            </label>

            <div className="flex justify-end">
              <Button
                onClick={handleComplete}
                loading={completeLoading}
                loadingText="재설정 중"
              >
                비밀번호 재설정
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>
    </div>
  );
}
