"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/ui/PasswordInput";
import Input from "@/components/ui/Input";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import FormMessage from "@/components/ui/FormMessage";
import { isValidPassword } from "@/lib/password";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import { parseSignupSsafyYearValue } from "@/lib/ssafy-year";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";
import type { RequiredPolicyMap } from "@/lib/policy-documents";

type Step = "request" | "verify";

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
  const [year, setYear] = useState(() => {
    return String(defaultYear);
  });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [policyChecked, setPolicyChecked] = useState({
    service: false,
    privacy: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
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

  const requestCode = async () => {
    if (pending) {
      return;
    }
    if (!username) {
      setError("MM 아이디를 입력해 주세요.");
      return;
    }
    const usernameError = validateMmUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    const parsedYear = parseSignupSsafyYearValue(year);
    if (parsedYear === null || !signupYears.includes(parsedYear)) {
      setError(
        `회원가입은 현재 선택 가능한 ${signupYearsText}만 선택할 수 있습니다.`,
      );
      return;
    }
    if (!password) {
      setError("사이트 비밀번호를 입력해 주세요.");
      return;
    }
    if (!isValidPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!policyChecked.service || !policyChecked.privacy) {
      setError("필수 약관에 모두 동의해 주세요.");
      return;
    }
    setPending(true);
    const normalizedUsername = normalizeMmUsername(username);
    try {
      const response = await fetch("/api/mm/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          year: parsedYear,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "blocked") {
          setError("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
          notify("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (data.error === "cooldown") {
          setError("인증코드 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.");
          notify("잠시 후 다시 요청해 주세요.");
          return;
        }
        if (data.error === "request_failed") {
          setError("MM 계정을 확인할 수 없습니다.");
          notify("MM 계정을 확인할 수 없습니다.");
          return;
        }
        if (data.error === "invalid_username") {
          setError("MM 아이디 형식을 확인해 주세요.");
          notify("MM 아이디 형식을 확인해 주세요.");
          return;
        }
        if (data.error === "invalid_year") {
          setError(
            data.message ??
              `회원가입은 현재 선택 가능한 ${signupYearsText}만 선택할 수 있습니다.`,
          );
          notify("회원가입 가능한 기수를 확인해 주세요.");
          return;
        }
        setError("MM 계정을 확인할 수 없습니다.");
        notify("MM 계정을 확인할 수 없습니다.");
        return;
      }
      setError(null);
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
      setError(usernameError);
      return;
    }
    if (!policyChecked.service || !policyChecked.privacy) {
      setError("필수 약관에 모두 동의해 주세요.");
      return;
    }
    setPending(true);
    const normalizedUsername = normalizeMmUsername(username);
    try {
      const response = await fetch("/api/mm/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          code,
          password,
          servicePolicyId: policies.service.id,
          privacyPolicyId: policies.privacy.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "blocked") {
          setError("인증 실패가 누적되어 1시간 차단되었습니다.");
          notify("인증 실패가 누적되어 1시간 차단되었습니다.");
          return;
        }
        if (data.error === "expired") {
          setError("인증코드가 만료되었습니다. 다시 요청해 주세요.");
          notify("인증코드가 만료되었습니다. 다시 요청해 주세요.");
          setStep("request");
          return;
        }
        if (data.error === "invalid_password") {
          setError(data.message ?? PASSWORD_POLICY_MESSAGE);
          notify(data.message ?? PASSWORD_POLICY_MESSAGE);
          return;
        }
        if (data.error === "policy_required") {
          setError("필수 약관에 모두 동의해 주세요.");
          notify("필수 약관에 모두 동의해 주세요.");
          return;
        }
        if (data.error === "policy_outdated") {
          setError(data.message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.");
          notify("약관이 갱신되었습니다. 다시 확인해 주세요.");
          router.refresh();
          return;
        }
        if (data.error === "invalid_username") {
          setError("MM 아이디 형식을 확인해 주세요.");
          notify("MM 아이디 형식을 확인해 주세요.");
          return;
        }
        setError("인증코드가 올바르지 않습니다.");
        notify("인증코드가 올바르지 않습니다.");
        return;
      }
      setError(null);
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
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        SSAFY 기수
        <div className="grid grid-cols-3 gap-2">
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
                  }
                }}
                disabled={step === "verify"}
              >
                {optionYear === 0 ? "운영진" : `${optionYear}기`}
              </Button>
            );
          })}
        </div>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        사이트 비밀번호
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          required
        />
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
            onChange={(checked) =>
              setPolicyChecked((prev) => ({ ...prev, service: checked }))
            }
            disabled={pending}
          />
          <PolicyAgreementField
            policy={policies.privacy}
            checked={policyChecked.privacy}
            onChange={(checked) =>
              setPolicyChecked((prev) => ({ ...prev, privacy: checked }))
            }
            disabled={pending}
          />
        </div>
      </section>

      {step === "verify" ? (
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          인증코드
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="MM DM으로 받은 코드"
            required
          />
        </label>
      ) : null}

      {error ? <FormMessage variant="error">{error}</FormMessage> : null}

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
          <Button variant="ghost" onClick={() => setStep("request")} disabled={pending}>
            다시 요청하기
          </Button>
        </div>
      )}
    </div>
  );
}
