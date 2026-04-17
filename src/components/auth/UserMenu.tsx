"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";
import { cn } from "@/lib/cn";

export default function UserMenu({
  initialSession = null,
  className,
  buttonClassName,
  logoutIconOnly = false,
}: {
  initialSession?: HeaderSession | null;
  className?: string;
  buttonClassName?: string;
  logoutIconOnly?: boolean;
}) {
  const [session, setSession] = useState<HeaderSession | null>(initialSession);
  const [loggingOut, setLoggingOut] = useState(false);
  const { notify } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    if (typeof window !== "undefined") {
      const ok = window.confirm("로그아웃하시겠습니까?");
      if (!ok) {
        return;
      }
    }
    setLoggingOut(true);
    try {
      await fetch("/api/mm/logout", { method: "POST" });
      setSession(null);
      notify("로그아웃되었습니다.");
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  };

  if (!session) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          href="/auth/login"
          prefetch={false}
          className={buttonClassName}
        >
          로그인
        </Button>
        <Button
          variant="ghost"
          href="/auth/signup"
          prefetch={false}
          className={buttonClassName}
        >
          회원가입
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        href="/certification"
        prefetch={false}
        className={buttonClassName}
      >
        내 프로필 조회
      </Button>
      {logoutIconOnly ? (
        <Button
          variant="danger"
          size="icon"
          onClick={handleLogout}
          loading={loggingOut}
          className={buttonClassName}
          ariaLabel="로그아웃"
          title="로그아웃"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          variant="danger"
          onClick={handleLogout}
          loading={loggingOut}
          loadingText="로그아웃 중"
          className={buttonClassName}
        >
          로그아웃
        </Button>
      )}
    </div>
  );
}
