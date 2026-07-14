"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { PASSWORD_POLICY_MESSAGE, isValidPasswordPolicy } from "@/lib/validation";

export default function ManualMemberPasswordSetupView({
  initialToken,
}: {
  /** Story/test-only token. Production links keep the value in the URL fragment. */
  initialToken?: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken ?? "");
  const [ready, setReady] = useState(Boolean(initialToken));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialToken) return;
    const fragment = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const nextToken = new URLSearchParams(fragment).get("token")?.trim() ?? "";
    if (nextToken) {
      setToken(nextToken);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } else {
      setMessage("비밀번호 설정 링크가 없거나 이미 사용되었습니다. 관리자에게 새 링크를 요청해 주세요.");
    }
    setReady(true);
  }, [initialToken]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!isValidPasswordPolicy(password)) {
      setMessage(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setMessage("새 비밀번호와 확인 값이 일치하지 않습니다.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/member-password-action/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "비밀번호를 설정하지 못했습니다.");
      router.replace("/certification/photo");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비밀번호를 설정하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="text-ko-title text-2xl font-semibold">계정 비밀번호 설정</h1>
      <p className="text-ko-pretty mt-2 text-sm text-muted-foreground">설정 후에는 본인 사진을 제출해 주세요. 사진 검토 중에도 일반 서비스는 이용할 수 있습니다.</p>
      <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
        <label className="grid gap-2 text-sm font-medium">새 비밀번호<PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
        <label className="grid gap-2 text-sm font-medium">새 비밀번호 확인<PasswordInput value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
        {message ? <FormMessage variant="error">{message}</FormMessage> : null}
        <Button type="submit" disabled={!ready || !token} loading={pending} loadingText="설정 중">비밀번호 설정 완료</Button>
      </form>
    </Card>
  );
}
