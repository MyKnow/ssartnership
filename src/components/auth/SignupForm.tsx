"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import { isValidPassword } from "@/lib/password";
import type { RequiredPolicyMap } from "@/lib/policy-documents";
import { parseSignupSsafyYearValue } from "@/lib/ssafy-year";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";

type Step = "request" | "verify";
type SignupField = "username" | "year" | "password" | "code" | "policies";

export default function SignupForm({
  policies,
  selectableYears,
  signupYearsText,
  defaultYear,
}: {
  policies: RequiredPolicyMap;
  selectableYears: number[];
  signupYearsText: string;
  defaultYear: number;
}) {
  const [step, setStep] = useState<Step>("request");
  const [username, setUsername] = useState("");
  const signupYears = useMemo(() => [...selectableYears, 0], [selectableYears]);
  const [year, setYear] = useState(() => String(defaultYear));
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [policyChecked, setPolicyChecked] = useState({
    service: false,
    privacy: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignupField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
  const usernameRef = useRef<HTMLInputElement>(null);
  const yearGroupRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const servicePolicyRef = useRef<HTMLInputElement>(null);

  const passwordGuideItems = [
    {
      label: "비밀번호 규칙",
      description: PASSWORD_POLICY_MESSAGE,
    },
    {
      label: "가입 가능한 기수",
      description: `회원가입은 현재 선택 가능한 ${signupYearsText}만 가능합니다.`,
    },
    {
      label: "인증코드 안내",
      description:
        "인증코드는 5분간 유효하며, 5회 실패 시 1시간 동안 인증이 제한됩니다.",
    },
  ] as const;

  function clearFieldError(field: SignupField) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  }

  function setSingleFieldError(field: SignupField, message: string) {
    setFieldErrors({ [field]: message });
    setFormError(null);
    if (field === "username") {
      focusField(usernameRef);
      return;
    }
    if (field === "year") {
      focusField(yearGroupRef);
      return;
    }
    if (field === "password") {
      focusField(passwordRef);
      return;
    }
    if (field === "code") {
      focusField(codeRef);
      return;
    }
    if (field === "policies") {
      focusField(servicePolicyRef);
    }
  }

  const requestCode = async () => {
    if (pending) {
      return;
    }
    if (!username.trim()) {
      setSingleFieldError("username", "MM 아이디를 입력해 주세요.");
      return;
    }
    const usernameError = validateMmUsername(username);
    if (usernameError) {
      setSingleFieldError("username", usernameError);
      return;
    }
    const parsedYear = parseSignupSsafyYearValue(year);
    if (parsedYear === null || !signupYears.includes(parsedYear)) {
      setSingleFieldError(
        "year",
        `회원가입은 현재 선택 가능한 ${signupYearsText}만 선택할 수 있습니다.`,
      );
      return;
    }
    if (!password) {
      setSingleFieldError("password", "사이트 비밀번호를 입력해 주세요.");
      return;
    }
    if (!isValidPassword(password)) {
      setSingleFieldError("password", PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!policyChecked.service || !policyChecked.privacy) {
      setSingleFieldError("policies", "필수 약관에 모두 동의해 주세요.");
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/mm/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          year: parsedYear,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "invalid_username") {
          setSingleFieldError("username", "MM 아이디 형식을 확인해 주세요.");
          return;
        }
        if (data.error === "invalid_year") {
          setSingleFieldError(
            "year",
            data.message ??
              `회원가입은 현재 선택 가능한 ${signupYearsText}만 선택할 수 있습니다.`,
          );
          return;
        }
        if (data.error === "blocked") {
          setFormError("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "cooldown") {
          setFormError("인증코드 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.");
          return;
        }
        setFormError("MM 계정을 확인할 수 없습니다.");
        return;
      }
      setFieldErrors({});
      setFormError(null);
      notify("인증코드를 전송했습니다. MM DM을 확인하세요.");
      setStep("verify");
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async () => {
    if (pending) {
      return;
    }

    const usernameError = validateMmUsername(username);
    if (usernameError) {
      setSingleFieldError("username", usernameError);
      return;
    }
    if (!code.trim()) {
      setSingleFieldError("code", "인증코드를 입력해 주세요.");
      return;
    }
    if (!policyChecked.service || !policyChecked.privacy) {
      setSingleFieldError("policies", "필수 약관에 모두 동의해 주세요.");
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/mm/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          code,
          password,
          servicePolicyId: policies.service.id,
          privacyPolicyId: policies.privacy.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "invalid_password") {
          setSingleFieldError("password", data.message ?? PASSWORD_POLICY_MESSAGE);
          return;
        }
        if (data.error === "policy_required") {
          setSingleFieldError("policies", "필수 약관에 모두 동의해 주세요.");
          return;
        }
        if (data.error === "invalid_username") {
          setSingleFieldError("username", "MM 아이디 형식을 확인해 주세요.");
          return;
        }
        if (data.error === "expired") {
          setFormError("인증코드가 만료되었습니다. 다시 요청해 주세요.");
          setStep("request");
          return;
        }
        if (data.error === "blocked") {
          setFormError("인증 실패가 누적되어 1시간 차단되었습니다.");
          return;
        }
        if (data.error === "policy_outdated") {
          setFormError(data.message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.");
          router.refresh();
          return;
        }
        setSingleFieldError("code", "인증코드가 올바르지 않습니다.");
        return;
      }
      setFieldErrors({});
      setFormError(null);
      notify("회원가입이 완료되었습니다.");
      router.replace("/notifications");
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
          name="username"
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
        SSAFY 기수
        <div
          ref={yearGroupRef}
          tabIndex={-1}
          className={getFieldErrorClass(
            Boolean(fieldErrors.year),
            "grid grid-cols-3 gap-2 rounded-2xl",
          )}
        >
          {signupYears.map((optionYear) => {
            const selected = year === String(optionYear);
            return (
              <Button
                key={optionYear}
                type="button"
                variant={selected ? "primary" : "ghost"}
                className="w-full justify-center rounded-2xl"
                onClick={() => {
                  if (step !== "verify") {
                    setYear(String(optionYear));
                    clearFieldError("year");
                  }
                }}
                disabled={step === "verify"}
                aria-invalid={Boolean(fieldErrors.year) || undefined}
              >
                {optionYear === 0 ? "운영진" : `${optionYear}기`}
              </Button>
            );
          })}
        </div>
        {fieldErrors.year ? (
          <FormMessage variant="error">{fieldErrors.year}</FormMessage>
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
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          required
          aria-invalid={Boolean(fieldErrors.password) || undefined}
          className={getFieldErrorClass(Boolean(fieldErrors.password))}
        />
        {fieldErrors.password ? (
          <FormMessage variant="error">{fieldErrors.password}</FormMessage>
        ) : null}
      </label>

      <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">가입 안내</h2>
          <span className="text-xs text-muted-foreground">
            입력 전에 확인해 주세요
          </span>
        </div>
        <dl className="mt-4 space-y-3">
          {passwordGuideItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border/60 bg-background/70 px-3 py-2"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-foreground/90">
                {item.description}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">필수 약관 동의</h2>
          <p className="text-sm text-muted-foreground">
            회원가입을 진행하려면 아래 약관에 모두 동의해야 합니다.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <PolicyAgreementField
            policy={policies.service}
            checked={policyChecked.service}
            onChange={(checked) => {
              setPolicyChecked((prev) => ({ ...prev, service: checked }));
              clearFieldError("policies");
            }}
            disabled={pending}
            invalid={Boolean(fieldErrors.policies)}
            inputRef={servicePolicyRef}
          />
          <PolicyAgreementField
            policy={policies.privacy}
            checked={policyChecked.privacy}
            onChange={(checked) => {
              setPolicyChecked((prev) => ({ ...prev, privacy: checked }));
              clearFieldError("policies");
            }}
            disabled={pending}
            invalid={Boolean(fieldErrors.policies)}
          />
        </div>
        {fieldErrors.policies ? (
          <FormMessage className="mt-4" variant="error">
            {fieldErrors.policies}
          </FormMessage>
        ) : null}
      </section>

      {step === "verify" ? (
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          인증코드
          <Input
            ref={codeRef}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              clearFieldError("code");
            }}
            placeholder="MM DM으로 받은 코드"
            required
            aria-invalid={Boolean(fieldErrors.code) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.code))}
          />
          {fieldErrors.code ? (
            <FormMessage variant="error">{fieldErrors.code}</FormMessage>
          ) : null}
        </label>
      ) : null}

      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      {step === "request" ? (
        <Button
          onClick={requestCode}
          loading={pending}
          loadingText="코드 전송 중"
        >
          인증코드 요청
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            onClick={verifyCode}
            loading={pending}
            loadingText="가입 처리 중"
          >
            회원가입 완료
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep("request");
              setFormError(null);
            }}
            disabled={pending}
          >
            다시 요청하기
          </Button>
        </div>
      )}
    </div>
  );
}
