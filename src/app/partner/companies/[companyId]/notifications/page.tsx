import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import PartnerNotificationCenter from "@/components/partner/partner-notifications/PartnerNotificationCenter";
import PartnerNotificationSettingsPanel from "@/components/partner/partner-notifications/PartnerNotificationSettingsPanel";
import {
  getPartnerOperationalNotificationPreferences,
  listOperationalPushSubscriptionDevices,
} from "@/lib/operational-notifications";
import { getPartnerNotificationCenter } from "@/lib/partner-notifications";
import { getPartnerPasswordChangeHref } from "@/lib/partner-portal-paths";
import {
  assertPartnerPortalCompanyAccess,
} from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { getPushPublicKey, isPushConfigured } from "@/lib/push";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `알림센터 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerCompanyNotificationsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(companyId));
  }

  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    notFound();
  }

  const [data, preferences, devices] = await Promise.all([
    getPartnerNotificationCenter([scope.id], session.accountId),
    getPartnerOperationalNotificationPreferences(session.accountId),
    listOperationalPushSubscriptionDevices({
      ownerType: "partner",
      ownerId: session.accountId,
    }),
  ]);

  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="알림센터"
          description={`${scope.name}의 브랜드 변경, 리뷰, 운영 알림을 확인합니다. 수신 설정은 계정 전체에 적용됩니다.`}
        />
        <PartnerNotificationSettingsPanel
          pushConfigured={isPushConfigured()}
          publicKey={getPushPublicKey()}
          preferences={preferences}
          deviceCount={devices.length}
        />
        <PartnerNotificationCenter data={data} />
      </div>
    </Container>
  );
}
