"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";

export default function UserMenu({
  initialSession = null,
}: {
  initialSession?: HeaderSession | null;
}) {
  const [session, setSession] = useState<HeaderSession | null>(initialSession);
  const { notify } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("로그아웃하시겠습니까?");
      if (!ok) {
        return;
      }
    }
    await fetch("/api/mm/logout", { method: "POST" });
    setSession(null);
    notify("로그아웃되었습니다.");
    router.replace("/");
    router.refresh();
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
        내 프로필 조회
      </Button>
      <Button variant="ghost" onClick={handleLogout}>
        로그아웃
      </Button>
    </>
  );
}
