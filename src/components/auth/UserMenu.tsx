"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type SessionPayload = {
  userId: string;
  mmUsername?: string;
};

export default function UserMenu() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    const fetchSession = async () => {
      const response = await fetch("/api/mm/session");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as SessionPayload;
      if (data?.userId) {
        setSession(data);
      }
    };
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/mm/logout", { method: "POST" });
    notify("로그아웃되었습니다.");
    window.location.href = "/";
  };

  if (!session) {
    return (
      <>
        <Button variant="ghost" href="/auth/login">
          로그인
        </Button>
        <Button variant="ghost" href="/auth/signup">
          회원가입
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" href="/certification">
        {session.mmUsername ? `@${session.mmUsername}` : "교육생 인증"}
      </Button>
      <Button variant="ghost" onClick={handleLogout}>
        로그아웃
      </Button>
    </>
  );
}
