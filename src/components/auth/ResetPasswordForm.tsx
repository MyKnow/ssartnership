"use client";

import { useRef, useState } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export default function ResetPasswordForm() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [pendingVerify, setPendingVerify] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    code?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { notify } = useToast();
  const usernameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  function clearCodeField() {
    setCode("");
    setFieldErrors((prev) => ({
      ...prev,
      code: undefined,
    }));
  }

  function handleUsernameChange(nextUsername: string) {
    setUsername(nextUsername);
    setFieldErrors((prev) => ({ ...prev, username: undefined }));
    setFormError(null);
    if (codeRequested) {
      setCodeRequested(false);
      clearCodeField();
      window.setTimeout(() => focusField(usernameRef), 0);
    }
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
      setCodeRequested(true);
      clearCodeField();
      setFormError(null);
      setFieldErrors((prev) => ({
        ...prev,
        username: undefined,
        code: undefined,
      }));
      window.setTimeout(() => focusField(codeRef), 0);
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
          clearCodeField();
          return;
        }
        if (data.error === "blocked") {
          setFormError("인증번호 확인이 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setFormError("인증번호 확인에 실패했습니다.");
        return;
      }

      const completionToken =
        typeof data.completionToken === "string" ? data.completionToken : "";
      if (!completionToken) {
        setFormError("인증번호 확인에 실패했습니다.");
        return;
      }

      notify("인증번호가 확인되었습니다.");
      window.location.replace(
        `/auth/reset/complete?token=${encodeURIComponent(completionToken)}`,
      );
    } finally {
      setPendingVerify(false);
    }
  }

  const requestLoading = pendingRequest;
  const verifyLoading = pendingVerify;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section className="rounded-[1.5rem] border border-border/70 bg-surface-elevated p-4 shadow-[var(--shadow-raised)]">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            인증번호 발급 및 확인
          </h2>
          <p className="text-sm text-muted-foreground">
            가입된 MM 아이디로 인증번호를 발급받고, 확인이 끝나면 새 비밀번호
            설정 페이지로 이동합니다.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            MM 아이디
            <MmUsernameInput
              ref={usernameRef}
              value={username}
              onChange={(event) => {
                handleUsernameChange(event.target.value);
              }}
              aria-invalid={Boolean(fieldErrors.username) || undefined}
              className={`${getFieldErrorClass(Boolean(fieldErrors.username))} !shadow-[var(--shadow-raised)]`}
            />
            {fieldErrors.username ? (
              <FormMessage variant="error">{fieldErrors.username}</FormMessage>
            ) : null}
          </label>

          <div className="flex justify-end">
            <Button
              onClick={handleRequestCode}
              loading={requestLoading}
              loadingText={codeRequested ? "재발급 중" : "인증번호 발급 중"}
              variant={codeRequested ? "secondary" : "primary"}
              className="!shadow-[var(--shadow-raised)] hover:!shadow-[var(--shadow-floating)]"
            >
              {codeRequested ? "인증번호 재발급" : "인증번호 발급"}
            </Button>
          </div>
        </div>

        <div
          className={[
            "grid overflow-hidden transition-[max-height,opacity,transform,margin-top] duration-300 ease-out motion-reduce:transition-none",
            codeRequested
              ? "mt-4 max-h-[22rem] translate-y-0 opacity-100"
              : "max-h-0 -translate-y-2 opacity-0 pointer-events-none",
          ].join(" ")}
          aria-hidden={!codeRequested}
        >
          <div className="rounded-[1.5rem] border border-border/70 bg-surface-muted/90 p-4 shadow-[var(--shadow-raised)]">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                인증번호 확인
              </h3>
              <p className="text-sm text-muted-foreground">
                방금 받은 인증번호를 입력해 새 비밀번호 설정으로 이동합니다.
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
                  disabled={!codeRequested}
                  className={`${getFieldErrorClass(Boolean(fieldErrors.code))} !shadow-[var(--shadow-raised)]`}
                />
                {fieldErrors.code ? (
                  <FormMessage variant="error">{fieldErrors.code}</FormMessage>
                ) : null}
              </label>

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearCodeField();
                    window.setTimeout(() => focusField(codeRef), 0);
                  }}
                  disabled={!codeRequested || pendingVerify || pendingRequest}
                  className="!shadow-[var(--shadow-raised)] hover:!shadow-[var(--shadow-floating)]"
                >
                  다시 입력
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  loading={verifyLoading}
                  loadingText="확인 중"
                  variant="secondary"
                  disabled={!codeRequested}
                  className="!shadow-[var(--shadow-raised)] hover:!shadow-[var(--shadow-floating)]"
                >
                  인증번호 확인
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}
    </div>
  );
}
