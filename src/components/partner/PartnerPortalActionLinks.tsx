"use client";

import { usePathname } from "next/navigation";
import Button from "@/components/ui/Button";
import type { PartnerSession } from "@/lib/partner-session";

type PartnerPortalActionLinksProps = {
  session: PartnerSession | null;
  isMock: boolean;
};

export default function PartnerPortalActionLinks({
  session,
  isMock,
}: PartnerPortalActionLinksProps) {
  const pathname = usePathname();
  const isSetupRoute = pathname.startsWith("/partner/setup");

  if (isSetupRoute) {
    return null;
  }

  const authHref = session ? "/partner/logout" : "/partner/login";
  const authLabel = session ? "로그아웃" : "로그인";

  return (
    <>
      <Button variant="ghost" href="/partner">
        대시보드
      </Button>
      {isMock ? (
        <Button variant="ghost" href="/partner/setup">
          초기 설정
        </Button>
      ) : null}
      <Button variant="ghost" href="/partner/change-password">
        비밀번호 변경
      </Button>
      <Button
        variant="ghost"
        href={authHref}
        prefetch={session ? false : undefined}
      >
        {authLabel}
      </Button>
      <Button variant="ghost" href="/" className="hidden sm:inline-flex">
        공개 홈
      </Button>
    </>
  );
}
