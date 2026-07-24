"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { getFieldErrorClass } from "@/components/ui/form-field-state";
import { parseMattermostVerificationRequest } from "@/lib/mattermost-code-input";
import {
  getMattermostSenderGenerationOptions,
  isMattermostSenderGenerationAvailable,
} from "@/lib/mattermost-senders/availability-rules";
import {
  formatMattermostCodeRemainingTime,
  getMattermostCodeExpiresAt,
  getMattermostCodeRemainingSeconds,
  MATTERMOST_VERIFICATION_CODE_TTL_SECONDS,
} from "@/lib/mattermost-code-expiration";
import { sanitizeReturnTo } from "@/lib/return-to";
import {
  formatSsafyYearLabel,
  getSelectableSsafyYears,
  SSAFY_STAFF_YEAR,
} from "@/lib/ssafy-year";

type Purpose = "signup" | "reset_password";

type IssueResponse = {
  ok: boolean;
  challenge?: string;
  expiresInSeconds?: number;
  error?: string;
};

type VerifyResponse = {
  ok: boolean;
  nextPath?: string;
  existingMember?: boolean;
  error?: string;
};

function getErrorMessage(code: string | undefined) {
  if (code === "rate_limited") return "요청이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요.";
  if (code === "invalid_code") {
    return `인증 코드를 확인해 주세요. 코드는 ${MATTERMOST_VERIFICATION_CODE_TTL_SECONDS / 60}분 동안 한 번만 사용할 수 있습니다.`;
  }
  if (code === "unavailable") return "Mattermost 인증을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했습니다. 입력값을 확인해 주세요.";
}

export default function MattermostCodeVerificationForm({
  purpose,
  returnTo,
  className,
  activeSenderGenerations = [],
  configuredSenderGenerations = [],
}: {
  purpose: Purpose;
  returnTo?: string;
  className?: string;
  activeSenderGenerations?: readonly number[];
  configuredSenderGenerations?: readonly number[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [generation, setGeneration] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"username" | "generation", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef<HTMLSelectElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const codeInputId = useId();
  const codeTimerId = useId();
  const isSignup = purpose === "signup";
  const mattermostGenerationOptions = getMattermostSenderGenerationOptions({
    activeSenderGenerations,
    configuredSenderGenerations,
    selectableSenderGenerations: getSelectableSsafyYears(),
  }).map((generation) => ({
    value: String(generation),
    label: generation === SSAFY_STAFF_YEAR
      ? formatSsafyYearLabel(SSAFY_STAFF_YEAR)
      : formatSsafyYearLabel(generation),
  }));
  const codeRemainingSeconds = codeExpiresAt
    ? getMattermostCodeRemainingSeconds(codeExpiresAt, now)
    : 0;
  const isCodeExpired = Boolean(challenge) && codeExpiresAt !== null && codeRemainingSeconds === 0;
  const codeTimerLabel = isCodeExpired
    ? "인증 코드가 만료되었습니다."
    : `인증 코드 만료까지 ${formatMattermostCodeRemainingTime(codeRemainingSeconds)} 남음`;

  useEffect(() => {
    if (!codeExpiresAt) return;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [codeExpiresAt]);

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
      setCodeExpiresAt(getMattermostCodeExpiresAt(data.expiresInSeconds));
      setNow(Date.now());
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
    if (isCodeExpired) {
      setError("인증 코드가 만료되었습니다. Mattermost 계정을 다시 입력해 새 코드를 받아 주세요.");
      return;
    }
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
      if (isSignup && data.existingMember === true) {
        sessionStorage.setItem("signup:alreadyRegistered", "1");
      }
      const nextPath = isSignup
        ? `${data.nextPath}?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo, "/"))}`
        : data.nextPath;
      router.replace(nextPath);
    } finally {
      setPending(false);
    }
  }

  if (challenge) {
    return (
      <form className={className ?? "mt-6 flex flex-col gap-4"} onSubmit={verifyCode}>
        <p className="text-sm text-muted-foreground">
          입력한 Mattermost 계정으로 인증 코드를 보냈습니다.
        </p>
        <div className="flex flex-col gap-2 text-sm font-medium text-foreground">
          <label htmlFor={codeInputId}>6자리 인증 코드</label>
          <div className="relative">
            <Input
              id={codeInputId}
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              aria-describedby={codeTimerId}
              aria-invalid={Boolean(error) || undefined}
              className="pr-16"
            />
            <span
              id={codeTimerId}
              role="timer"
              aria-label={codeTimerLabel}
              className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium tabular-nums ${
                isCodeExpired ? "text-danger" : "text-muted-foreground"
              }`}
            >
              {formatMattermostCodeRemainingTime(codeRemainingSeconds)}
            </span>
          </div>
        </div>
        {error ? <FormMessage variant="error">{error}</FormMessage> : null}
        <Button type="submit" loading={pending} loadingText="확인 중" disabled={isCodeExpired}>
          인증 확인
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => {
          setChallenge(null);
          setCode("");
          setCodeExpiresAt(null);
          setNow(Date.now());
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
      {!isSignup ? (
        <p className="text-sm text-muted-foreground">
          가입 때 연결한 Mattermost 계정으로 6자리 인증 코드를 DM으로 보냅니다.
        </p>
      ) : null}
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
          placeholder="예: myknow"
          aria-invalid={Boolean(fieldErrors.username) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.username))}
        />
        {fieldErrors.username ? <FormMessage variant="error">{fieldErrors.username}</FormMessage> : null}
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        기수
        <Select
          ref={generationRef}
          name="generation"
          aria-label="기수"
          value={generation}
          onChange={(event) => {
            setGeneration(event.target.value);
            setFieldErrors((current) => ({ ...current, generation: undefined }));
          }}
          aria-invalid={Boolean(fieldErrors.generation) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.generation))}
        >
          <option value="" disabled>
            기수를 선택해 주세요
          </option>
          {mattermostGenerationOptions.map((option) => {
            const generationValue = Number(option.value);
            const available = isMattermostSenderGenerationAvailable(
              generationValue,
              activeSenderGenerations,
            );
            const label = !available
              ? `${option.label}(예정)`
              : option.label;

            return (
              <option
                key={option.value}
                value={option.value}
                disabled={!available}
              >
                {label}
              </option>
            );
          })}
        </Select>
        {fieldErrors.generation ? <FormMessage variant="error">{fieldErrors.generation}</FormMessage> : null}
      </label>
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
      <Button type="submit" loading={pending} loadingText="코드 전송 중">
        Mattermost DM으로 코드 받기
      </Button>
    </form>
  );
}
