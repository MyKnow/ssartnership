import CertificationAccountSettings from "@/components/certification/CertificationAccountSettings";
import PageHeader from "@/components/ui/PageHeader";

export default function MemberSettingsView({
  hasMattermostAccount,
  email,
  emailVerified,
  backHref,
  returnTo,
}: {
  hasMattermostAccount: boolean;
  email?: string | null;
  emailVerified?: boolean;
  backHref: string;
  returnTo: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="설정"
        backHref={backHref}
        backLabel="이전 화면으로 돌아가기"
        className="border-b-0"
      />
      <CertificationAccountSettings
        hasMattermostAccount={hasMattermostAccount}
        email={email}
        emailVerified={emailVerified}
        canChangeProfilePhoto
        returnTo={returnTo}
      />
    </div>
  );
}
