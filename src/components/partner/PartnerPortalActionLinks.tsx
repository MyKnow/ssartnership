"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import PartnerLogoutButton from "@/components/partner/PartnerLogoutButton";
import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
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
  const isProfileRoute = pathname.includes("/account");

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
          <PartnerPendingButtonLink variant="ghost" href="/" className="hidden sm:inline-flex">
            공개 홈
          </PartnerPendingButtonLink>
        ) : null}
      </>
    );
  }

  return (
    <>
      {isDashboardRoute ? null : (
        <PartnerPendingButtonLink variant="ghost" href="/partner">
          대시보드
        </PartnerPendingButtonLink>
      )}
      <PartnerPendingButtonLink
        variant={isNotificationsRoute ? "soft" : "ghost"}
        href="/partner/notifications"
      >
        알림센터
      </PartnerPendingButtonLink>
      {isMock ? (
        <PartnerPendingButtonLink variant="ghost" href="/partner/setup">
          초기 설정
        </PartnerPendingButtonLink>
      ) : null}
      <PartnerPendingButtonLink
        variant={isProfileRoute ? "soft" : "ghost"}
        href="/partner/account"
      >
        프로필
      </PartnerPendingButtonLink>
      {supportLink}
      {logoutIconOnly ? (
        <PartnerLogoutButton
          variant="danger"
          size="icon"
          formClassName="inline-flex"
          ariaLabel="로그아웃"
          title="로그아웃"
        >
          <LogOut className="h-5 w-5" />
        </PartnerLogoutButton>
      ) : (
        <PartnerLogoutButton formClassName="inline-flex" variant="danger">
          로그아웃
        </PartnerLogoutButton>
      )}
      {showPublicHome ? (
        <PartnerPendingButtonLink variant="ghost" href="/" className="hidden sm:inline-flex">
          공개 홈
        </PartnerPendingButtonLink>
      ) : null}
    </>
  );
}
