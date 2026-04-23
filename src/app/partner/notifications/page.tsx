import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import PartnerNotificationCenter from "@/components/partner/partner-notifications/PartnerNotificationCenter";
import { getPartnerNotificationCenter } from "@/lib/partner-notifications";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `알림센터 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerNotificationsPage() {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const data = await getPartnerNotificationCenter(session.companyIds, session.accountId);

  return (
    <Container className="pb-16 pt-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="알림센터"
          description="협력사 계정에 연결된 브랜드 변경, 리뷰, 운영 알림을 한곳에서 확인합니다."
        />
        <PartnerNotificationCenter data={data} />
      </div>
    </Container>
  );
}
