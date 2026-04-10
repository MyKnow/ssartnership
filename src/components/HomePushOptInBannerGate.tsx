import PushOptInBanner from "@/components/PushOptInBanner";
import { getMemberPushPreferences, isPushConfigured } from "@/lib/push";

export default async function HomePushOptInBannerGate({
  memberId,
}: {
  memberId: string | null;
}) {
  if (!memberId || !isPushConfigured()) {
    return null;
  }

  const pushPreferences = await getMemberPushPreferences(memberId);
  if (pushPreferences.enabled) {
    return null;
  }

  return <PushOptInBanner />;
}
