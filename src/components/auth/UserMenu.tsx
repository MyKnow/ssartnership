"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";
import { cn } from "@/lib/cn";
import { sanitizeReturnTo } from "@/lib/return-to";

export default function UserMenu({
  initialSession = null,
  className,
  buttonClassName,
  logoutIconOnly = false,
  guestAuthReturnTo,
  showMemberNavigation = true,
  showAuthIcons = false,
}: {
  initialSession?: HeaderSession | null;
  className?: string;
  buttonClassName?: string;
  logoutIconOnly?: boolean;
  guestAuthReturnTo?: string;
  showMemberNavigation?: boolean;
  showAuthIcons?: boolean;
}) {
  const [session, setSession] = useState<HeaderSession | null>(initialSession);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
  const safeGuestAuthReturnTo = guestAuthReturnTo
    ? sanitizeReturnTo(guestAuthReturnTo, "/")
    : null;
  const loginHref = safeGuestAuthReturnTo
    ? `/auth/login?returnTo=${encodeURIComponent(safeGuestAuthReturnTo)}`
    : "/auth/login";
  const signupHref = safeGuestAuthReturnTo
    ? `/auth/signup?returnTo=${encodeURIComponent(safeGuestAuthReturnTo)}`
    : "/auth/signup";

  const openLogoutConfirmation = () => {
    if (!loggingOut) {
      setLogoutConfirmationOpen(true);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch("/api/mm/logout", { method: "POST" });
      setLogoutConfirmationOpen(false);
      setSession(null);
      notify("로그아웃되었습니다.");
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  };

  const logoutConfirmation = (
    <ConfirmDialog
      open={logoutConfirmationOpen}
      title="로그아웃하시겠습니까?"
      description="현재 계정의 로그인 세션을 종료합니다."
      confirmLabel="로그아웃"
      pendingLabel="로그아웃 중"
      pending={loggingOut}
      onClose={() => setLogoutConfirmationOpen(false)}
      onConfirm={() => void handleLogout()}
    />
  );

  if (!session) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          href={loginHref}
          prefetch={false}
          className={buttonClassName}
        >
          {showAuthIcons ? <LogIn className="h-5 w-5" aria-hidden="true" /> : null}
          로그인
        </Button>
        <Button
          variant="ghost"
          href={signupHref}
          prefetch={false}
          className={buttonClassName}
        >
          {showAuthIcons ? <UserPlus className="h-5 w-5" aria-hidden="true" /> : null}
          회원가입
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showMemberNavigation ? (
        <>
          <Button
            variant="ghost"
            href="/coupons"
            prefetch={false}
            className={buttonClassName}
          >
            쿠폰함
          </Button>
          <Button
            variant="ghost"
            href="/certification"
            prefetch={false}
            className={buttonClassName}
          >
            내 인증
          </Button>
        </>
      ) : null}
      {logoutIconOnly ? (
        <Button
          variant="danger"
          size="icon"
          onClick={openLogoutConfirmation}
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
          onClick={openLogoutConfirmation}
          loading={loggingOut}
          loadingText="로그아웃 중"
          className={buttonClassName}
        >
          {showAuthIcons ? <LogOut className="h-5 w-5" aria-hidden="true" /> : null}
          로그아웃
        </Button>
      )}
      {logoutConfirmation}
    </div>
  );
}
