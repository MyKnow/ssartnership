"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export default function ResetPasswordForm() {
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { notify } = useToast();
  const router = useRouter();
  const usernameRef = useRef<HTMLInputElement>(null);

  const handleReset = async () => {
    if (pending) {
      return;
    }

    if (!username.trim()) {
      setFieldError("MM 아이디를 입력해 주세요.");
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    const usernameError = validateMmUsername(username);
    if (usernameError) {
      setFieldError(usernameError);
      setFormError(null);
      focusField(usernameRef);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setPending(true);

    try {
      const response = await fetch("/api/mm/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizeMmUsername(username) }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "invalid_username") {
          setFieldError("MM 아이디 형식을 확인해 주세요.");
          setFormError(null);
          focusField(usernameRef);
          return;
        }
        if (data.error === "cooldown") {
          setFormError("재설정 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "blocked") {
          setFormError("재설정 요청이 제한되었습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setFormError("비밀번호 재설정에 실패했습니다.");
        return;
      }

      setFieldError(null);
      setFormError(null);
      notify("임시 비밀번호가 MM DM으로 전송되었습니다.");
      sessionStorage.setItem("reset:success", "1");
      router.push("/auth/login");
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
            setFieldError(null);
            setFormError(null);
          }}
          aria-invalid={Boolean(fieldError) || undefined}
          className={getFieldErrorClass(Boolean(fieldError))}
        />
        {fieldError ? <FormMessage variant="error">{fieldError}</FormMessage> : null}
      </label>

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <Button
        onClick={handleReset}
        loading={pending}
        loadingText="임시 비밀번호 발급 중"
      >
        임시 비밀번호 발급
      </Button>
    </div>
  );
}
