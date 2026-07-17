"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { getFieldErrorClass } from "@/components/ui/form-field-state";
import { parseMattermostVerificationRequest } from "@/lib/mattermost-code-input";
import { sanitizeReturnTo } from "@/lib/return-to";

type Purpose = "signup" | "reset_password";

type IssueResponse = {
  ok: boolean;
  challenge?: string;
  error?: string;
};

type VerifyResponse = {
  ok: boolean;
  nextPath?: string;
  error?: string;
};

function getErrorMessage(code: string | undefined) {
  if (code === "rate_limited") return "요청이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.";
  if (code === "invalid_code") return "인증 코드를 확인해 주세요. 코드는 10분 동안 한 번만 사용할 수 있습니다.";
  if (code === "unavailable") return "Mattermost 인증을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했습니다. 입력값을 확인해 주세요.";
}

export default function MattermostCodeVerificationForm({
  purpose,
  returnTo,
  className,
}: {
  purpose: Purpose;
  returnTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [generation, setGeneration] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"username" | "generation", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const isSignup = purpose === "signup";

  function focusFirstField(nextErrors: Partial<Record<"username" | "generation", string>>) {
    if (nextErrors.username) {
      usernameRef.current?.focus();
      return;
    }
    if (nextErrors.generation) {
      generationRef.current?.focus();
    }
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseMattermostVerificationRequest({ username, generation });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(null);
      focusFirstField(parsed.fieldErrors);
      return;
    }
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/mm/code/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, ...parsed.data }),
      });
      const data = await response.json().catch(() => ({})) as IssueResponse;
      if (!response.ok || !data.ok || !data.challenge) {
        setError(getErrorMessage(data.error));
        return;
      }
      setChallenge(data.challenge);
      setCode("");
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !challenge) return;
    const normalizedCode = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("6자리 숫자 인증 코드를 입력해 주세요.");
      codeRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/mm/code/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, challenge, code: normalizedCode }),
      });
      const data = await response.json().catch(() => ({})) as VerifyResponse;
      if (!response.ok || !data.ok || !data.nextPath) {
        setError(getErrorMessage(data.error));
        return;
      }
      const nextPath = isSignup
        ? `${data.nextPath}?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo, "/"))}`
        : data.nextPath;
      router.replace(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (challenge) {
    return (
      <form className={className ?? "mt-6 flex flex-col gap-4"} onSubmit={verifyCode}>
        <p className="text-sm text-muted-foreground">
          입력한 Mattermost 계정으로 인증 코드를 보냈습니다. 계정 존재 여부는 보안상 안내하지 않습니다.
        </p>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          6자리 인증 코드
          <Input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            aria-invalid={Boolean(error) || undefined}
          />
        </label>
        {error ? <FormMessage variant="error">{error}</FormMessage> : null}
        <Button type="submit" loading={pending} loadingText="확인 중">
          인증 확인
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => {
          setChallenge(null);
          setCode("");
          setError(null);
          requestAnimationFrame(() => usernameRef.current?.focus());
        }}>
          다른 Mattermost 계정 입력
        </Button>
      </form>
    );
  }

  return (
    <form className={className ?? "mt-6 flex flex-col gap-4"} onSubmit={requestCode}>
      <p className="text-sm text-muted-foreground">
        {isSignup
          ? "기수의 Mattermost Sender가 6자리 인증 코드를 DM으로 보냅니다."
          : "가입 때 연결한 Mattermost 계정으로 6자리 인증 코드를 DM으로 보냅니다."}
      </p>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        Mattermost ID
        <Input
          ref={usernameRef}
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setFieldErrors((current) => ({ ...current, username: undefined }));
          }}
          placeholder="예: ssafy.user"
          aria-invalid={Boolean(fieldErrors.username) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.username))}
        />
        {fieldErrors.username ? <FormMessage variant="error">{fieldErrors.username}</FormMessage> : null}
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        기수 <span className="font-normal text-muted-foreground">(운영진은 0)</span>
        <Input
          ref={generationRef}
          name="generation"
          inputMode="numeric"
          value={generation}
          onChange={(event) => {
            setGeneration(event.target.value);
            setFieldErrors((current) => ({ ...current, generation: undefined }));
          }}
          placeholder="예: 15"
          aria-invalid={Boolean(fieldErrors.generation) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.generation))}
        />
        {fieldErrors.generation ? <FormMessage variant="error">{fieldErrors.generation}</FormMessage> : null}
      </label>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <Button type="submit" loading={pending} loadingText="코드 전송 중">
        Mattermost DM으로 코드 받기
      </Button>
    </form>
  );
}
