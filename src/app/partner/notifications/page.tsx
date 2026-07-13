import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PartnerNotificationsScreen from "@/components/partner/PartnerNotificationsScreen";
import {
  getPartnerOperationalNotificationPreferences,
  listOperationalPushSubscriptionDevices,
} from "@/lib/operational-notifications";
import { getPartnerNotificationCenter } from "@/lib/partner-notifications";
import { getPartnerSession } from "@/lib/partner-session";
import { getPushPublicKey, isPushConfigured } from "@/lib/push";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `알림 | ${SITE_NAME}`,
  robots: { index: false, follow: false },
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

  const [data, preferences, devices] = await Promise.all([
    getPartnerNotificationCenter(session.companyIds, session.accountId),
    getPartnerOperationalNotificationPreferences(session.accountId),
    listOperationalPushSubscriptionDevices({
      ownerType: "partner",
      ownerId: session.accountId,
    }),
  ]);

  return (
    <PartnerNotificationsScreen
      data={data}
      pushConfigured={isPushConfigured()}
      publicKey={getPushPublicKey()}
      preferences={preferences}
      deviceCount={devices.length}
    />
  );
}
