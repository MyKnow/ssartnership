"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/ui/PasswordInput";
import Input from "@/components/ui/Input";
import MmUsernameInput from "@/components/auth/MmUsernameInput";
import FormMessage from "@/components/ui/FormMessage";
import { isValidPassword } from "@/lib/password";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";

type Step = "request" | "verify";

export default function SignupForm() {
  const [step, setStep] = useState<Step>("request");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const router = useRouter();

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
    if (!password) {
      setError("사이트 비밀번호를 입력해 주세요.");
      return;
    }
    if (!isValidPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    setPending(true);
    const normalizedUsername = normalizeMmUsername(username);
    try {
      const response = await fetch("/api/mm/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "cooldown") {
          setError("인증코드 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.");
          notify("잠시 후 다시 요청해 주세요.");
          return;
        }
        if (data.error === "already_registered") {
          setError("이미 가입된 계정입니다. 로그인해 주세요.");
          notify("이미 가입된 계정입니다.");
          return;
        }
        if (data.error === "not_student") {
          setError("해당 아이디는 교육생 채널에 존재하지 않습니다.");
          notify("교육생 채널에 없는 아이디입니다.");
          return;
        }
        if (data.error === "invalid_username") {
          setError("MM 아이디 형식을 확인해 주세요.");
          notify("MM 아이디 형식을 확인해 주세요.");
          return;
        }
        if (data.error === "request_failed") {
          setError(data.message ?? "요청에 실패했습니다.");
          notify(data.message ?? "요청에 실패했습니다.");
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
      router.replace("/certification");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <MmUsernameInput
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
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

      <FormMessage>
        {PASSWORD_POLICY_MESSAGE} 인증코드는 5분간 유효하며, 5회 실패 시
        1시간 동안 인증이 제한됩니다.
      </FormMessage>

      {step === "request" ? (
        <Button onClick={requestCode} disabled={pending}>
          인증코드 요청
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button onClick={verifyCode} disabled={pending}>
            회원가입 완료
          </Button>
          <Button variant="ghost" onClick={() => setStep("request")}>
            다시 요청하기
          </Button>
        </div>
      )}
    </div>
  );
}
