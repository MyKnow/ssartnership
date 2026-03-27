"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/ui/PasswordInput";

type Step = "request" | "verify";

export default function SignupForm() {
  const [step, setStep] = useState<Step>("request");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const invalidId = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith("@") || trimmed.includes("@");
  };

  const requestCode = async () => {
    if (pending) {
      return;
    }
    if (!username) {
      setError("MM 아이디를 입력해 주세요.");
      return;
    }
    if (invalidId(username)) {
      setError("MM 아이디는 @ 없이 입력해 주세요.");
      return;
    }
    if (!password) {
      setError("사이트 비밀번호를 입력해 주세요.");
      return;
    }
    const passwordOk =
      password.length >= 8 &&
      password.length <= 64 &&
      /[A-Za-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!passwordOk) {
      setError("비밀번호는 영문/숫자/특수문자 포함 8자 이상이어야 합니다.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/mm/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
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
    if (invalidId(username)) {
      setError("MM 아이디는 @ 없이 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/mm/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code, password }),
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
          setError("비밀번호 정책에 맞지 않습니다.");
          notify("비밀번호 정책에 맞지 않습니다.");
          return;
        }
        setError("인증코드가 올바르지 않습니다.");
        notify("인증코드가 올바르지 않습니다.");
        return;
      }
      setError(null);
      notify("회원가입이 완료되었습니다.");
      window.location.href = "/certification";
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        MM 아이디
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="MM 아이디"
          required
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

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        비밀번호는 8~64자, 영문/숫자/특수문자를 모두 포함해야 합니다. 인증코드는
        5분간 유효하며, 5회 실패 시 1시간 동안 인증이 제한됩니다.
      </p>

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
