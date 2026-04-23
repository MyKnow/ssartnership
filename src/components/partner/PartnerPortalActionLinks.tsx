"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import { TECH_SUPPORT_HREF } from "@/lib/support-mail";
import type { PartnerSession } from "@/lib/partner-session";

type PartnerPortalActionLinksProps = {
  session: PartnerSession | null;
  isMock: boolean;
  logoutIconOnly?: boolean;
  showPublicHome?: boolean;
};

export default function PartnerPortalActionLinks({
  session,
  isMock,
  logoutIconOnly = false,
  showPublicHome = true,
}: PartnerPortalActionLinksProps) {
  const pathname = usePathname();
  const isSetupRoute = pathname.startsWith("/partner/setup");
  const isDashboardRoute = pathname === "/partner";
  const isNotificationsRoute = pathname === "/partner/notifications";

  const supportLink = (
    <Button variant="ghost" href={TECH_SUPPORT_HREF}>
      기술 지원
    </Button>
  );

  if (isSetupRoute || !session) {
    return (
      <>
        {supportLink}
        {showPublicHome ? (
          <Button variant="ghost" href="/" className="hidden sm:inline-flex">
            공개 홈
          </Button>
        ) : null}
      </>
    );
  }

  const authHref = "/partner/logout";

  return (
    <>
      {isDashboardRoute ? null : (
        <Button variant="ghost" href="/partner">
          대시보드
        </Button>
      )}
      <Button
        variant={isNotificationsRoute ? "soft" : "ghost"}
        href="/partner/notifications"
      >
        알림센터
      </Button>
      {isMock ? (
        <Button variant="ghost" href="/partner/setup">
          초기 설정
        </Button>
      ) : null}
      <Button variant="ghost" href="/partner/change-password">
        비밀번호 변경
      </Button>
      {supportLink}
      {logoutIconOnly ? (
        <Button
          variant="danger"
          size="icon"
          href={authHref}
          prefetch={false}
          ariaLabel="로그아웃"
          title="로그아웃"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      ) : (
        <Button variant="danger" href={authHref} prefetch={false}>
          로그아웃
        </Button>
      )}
      {showPublicHome ? (
        <Button variant="ghost" href="/" className="hidden sm:inline-flex">
          공개 홈
        </Button>
      ) : null}
    </>
  );
}
