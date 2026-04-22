"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { sanitizeReturnTo } from "@/lib/return-to";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";

export default function ChangePasswordForm({
  returnTo,
}: {
  returnTo?: string;
}) {
  const [current, setCurrent] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    current?: string;
    nextPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);

  const handleChange = async () => {
    if (pending) {
      return;
    }

    if (!current || !nextPassword) {
      setFieldErrors({
        current: current ? undefined : "현재 비밀번호를 입력해 주세요.",
        nextPassword: nextPassword ? undefined : "새 비밀번호를 입력해 주세요.",
      });
      setFormError(null);
      focusField(current ? nextRef : currentRef);
      return;
    }

    setFieldErrors({});
    setFormError(null);
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
          setFieldErrors({ nextPassword: PASSWORD_POLICY_MESSAGE });
          setFormError(null);
          focusField(nextRef);
          return;
        }
        if (data.error === "wrong_password") {
          setFieldErrors({ current: "현재 비밀번호가 올바르지 않습니다." });
          setFormError(null);
          focusField(currentRef);
          return;
        }
        if (data.error === "blocked") {
          setFormError("변경 시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setFormError("비밀번호 변경에 실패했습니다.");
        return;
      }

      setFieldErrors({});
      setFormError(null);
      notify("비밀번호가 변경되었습니다.");
      window.location.replace(sanitizeReturnTo(returnTo, "/"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        현재 비밀번호
        <PasswordInput
          ref={currentRef}
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
            setFieldErrors((prev) => ({ ...prev, current: undefined }));
            setFormError(null);
          }}
          placeholder="현재 비밀번호"
          required
          aria-invalid={Boolean(fieldErrors.current) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.current))}
        />
        {fieldErrors.current ? (
          <FormMessage variant="error">{fieldErrors.current}</FormMessage>
        ) : null}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        새 비밀번호
        <PasswordInput
          ref={nextRef}
          value={nextPassword}
          onChange={(event) => {
            setNextPassword(event.target.value);
            setFieldErrors((prev) => ({ ...prev, nextPassword: undefined }));
            setFormError(null);
          }}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          required
          aria-invalid={Boolean(fieldErrors.nextPassword) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.nextPassword))}
        />
        {fieldErrors.nextPassword ? (
          <FormMessage variant="error">{fieldErrors.nextPassword}</FormMessage>
        ) : null}
      </label>

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}
      <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>

      <Button
        onClick={handleChange}
        loading={pending}
        loadingText="비밀번호 변경 중"
      >
        비밀번호 변경
      </Button>
    </div>
  );
}
