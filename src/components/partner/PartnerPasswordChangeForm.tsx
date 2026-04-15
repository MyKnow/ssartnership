"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";
import {
  getPartnerPortalPasswordChangeErrorMessage,
} from "@/lib/partner-password-errors";

export default function PartnerPasswordChangeForm({
  mustChangePassword,
}: {
  mustChangePassword: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    nextPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { notify } = useToast();
  const router = useRouter();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const nextPasswordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (pending) {
      return;
    }
    if (!currentPassword || !nextPassword) {
      setFieldErrors({
        currentPassword: currentPassword ? undefined : "현재 비밀번호를 입력해 주세요.",
        nextPassword: nextPassword ? undefined : "새 비밀번호를 입력해 주세요.",
      });
      setFormError(null);
      focusField(currentPassword ? nextPasswordRef : currentPasswordRef);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/partner/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? getPartnerPortalPasswordChangeErrorMessage(
                data.error as Parameters<typeof getPartnerPortalPasswordChangeErrorMessage>[0],
              )
            : "비밀번호 변경에 실패했습니다.";
        if (data.error === "wrong_password") {
          setFieldErrors({ currentPassword: message });
          setFormError(null);
          focusField(currentPasswordRef);
          return;
        }
        if (data.error === "invalid_password") {
          setFieldErrors({ nextPassword: message });
          setFormError(null);
          focusField(nextPasswordRef);
          return;
        }
        setFormError(message);
        return;
      }

      setFieldErrors({});
      setFormError(null);
      notify("비밀번호가 변경되었습니다.");
      router.replace("/partner");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {mustChangePassword ? (
        <FormMessage>
          임시 비밀번호로 로그인한 상태입니다. 지금 새 비밀번호를 설정해야
          계속 이용할 수 있습니다.
        </FormMessage>
      ) : null}

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        현재 비밀번호
        <PasswordInput
          ref={currentPasswordRef}
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
            setFormError(null);
          }}
          placeholder="현재 비밀번호"
          autoComplete="current-password"
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.currentPassword) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.currentPassword))}
        />
        {fieldErrors.currentPassword ? (
          <FormMessage variant="error">{fieldErrors.currentPassword}</FormMessage>
        ) : null}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        새 비밀번호
        <PasswordInput
          ref={nextPasswordRef}
          value={nextPassword}
          onChange={(event) => {
            setNextPassword(event.target.value);
            setFieldErrors((prev) => ({ ...prev, nextPassword: undefined }));
            setFormError(null);
          }}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          autoComplete="new-password"
          disabled={pending}
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
        onClick={handleSubmit}
        loading={pending}
        loadingText="변경 중"
      >
        비밀번호 변경
      </Button>
    </div>
  );
}
