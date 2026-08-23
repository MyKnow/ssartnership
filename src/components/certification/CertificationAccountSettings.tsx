import CertificationEmailSummary from "@/components/certification/CertificationEmailSummary";
import CertificationFooterActions from "@/components/certification/CertificationFooterActions";
import CertificationMattermostSyncAction from "@/components/certification/CertificationMattermostSyncAction";
import { CertificationSettingsGroup } from "@/components/certification/CertificationSettingsList";

export default function CertificationAccountSettings({
  hasMattermostAccount,
  email,
  emailVerified,
  canChangeProfilePhoto = false,
  returnTo,
}: {
  hasMattermostAccount: boolean;
  email?: string | null;
  emailVerified?: boolean;
  canChangeProfilePhoto?: boolean;
  returnTo: string;
}) {
  return (
    <section
      aria-label="계정 설정"
      className="space-y-6"
    >
      <CertificationSettingsGroup title="연결 정보">
        {hasMattermostAccount ? <CertificationMattermostSyncAction /> : null}
        <CertificationEmailSummary
          email={email}
          emailVerified={emailVerified}
          returnTo={returnTo}
        />
      </CertificationSettingsGroup>

      <CertificationFooterActions
        canChangeProfilePhoto={canChangeProfilePhoto}
        returnTo={returnTo}
      />
    </section>
  );
}
