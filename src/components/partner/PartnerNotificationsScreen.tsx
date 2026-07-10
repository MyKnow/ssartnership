import PartnerNotificationCenter from "@/components/partner/partner-notifications/PartnerNotificationCenter";
import PartnerNotificationSettingsPanel from "@/components/partner/partner-notifications/PartnerNotificationSettingsPanel";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import type { PartnerNotificationPreferenceState } from "@/lib/partner-notification-routing";
import type { PartnerNotificationCenterData } from "@/lib/partner-notifications";

export type PartnerNotificationsScreenProps = {
  data: PartnerNotificationCenterData;
  pushConfigured: boolean;
  publicKey: string;
  preferences: PartnerNotificationPreferenceState;
  deviceCount: number;
};

export default function PartnerNotificationsScreen({
  data,
  pushConfigured,
  publicKey,
  preferences,
  deviceCount,
}: PartnerNotificationsScreenProps) {
  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="알림"
          description="연결된 모든 파트너사의 제휴처 변경, 리뷰, 플랜, 운영 알림을 한곳에서 확인합니다."
        />
        <PartnerNotificationCenter data={data} />
        <PartnerNotificationSettingsPanel
          pushConfigured={pushConfigured}
          publicKey={publicKey}
          preferences={preferences}
          deviceCount={deviceCount}
        />
      </div>
    </Container>
  );
}
