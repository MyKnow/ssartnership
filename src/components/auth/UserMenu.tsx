"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type SessionPayload = {
  userId: string;
  mmUsername?: string;
};

export default function UserMenu() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const fetchSession = async () => {
      const response = await fetch("/api/mm/session", { cache: "no-store" });
      if (!response.ok) {
        if (active) {
          setLoaded(true);
        }
        return;
      }
      const data = (await response.json()) as SessionPayload;
      if (!active) {
        return;
      }
      if (data?.userId) {
        setSession(data);
      }
      setLoaded(true);
    };
    void fetchSession();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("로그아웃하시겠습니까?");
      if (!ok) {
        return;
      }
    }
    await fetch("/api/mm/logout", { method: "POST" });
    notify("로그아웃되었습니다.");
    router.replace("/");
    router.refresh();
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-12 w-24 rounded-full border border-border bg-surface-muted" />
        <span className="h-12 w-24 rounded-full border border-border bg-surface-muted" />
      </div>
    );
  }

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
        교육생 인증하기
      </Button>
      <Button variant="ghost" onClick={handleLogout}>
        로그아웃
      </Button>
    </>
  );
}
