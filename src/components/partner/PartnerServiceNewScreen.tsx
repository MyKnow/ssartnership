import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
import PartnerRegistrationClient from "@/components/partner-registration/PartnerRegistrationClient";
import type { PartnerRegistrationBrandProfile } from "@/components/partner-registration/usePartnerRegistrationController";
import type { PartnerRegistrationWebAction } from "@/components/partner-registration/usePartnerRegistrationController";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import type { AdminPartnerFileCategory } from "@/lib/admin-partner-file-import";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";

export type PartnerServiceNewScreenProps = {
  companyId: string;
  companyName: string;
  companyDescription?: string | null;
  displayName: string;
  contactEmail: string;
  categories: AdminPartnerFileCategory[];
  brandProfiles: PartnerRegistrationBrandProfile[];
  webAction: PartnerRegistrationWebAction;
};

export default function PartnerServiceNewScreen({
  companyId,
  companyName,
  companyDescription,
  displayName,
  contactEmail,
  categories,
  brandProfiles,
  webAction,
}: PartnerServiceNewScreenProps) {
  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-6 lg:pt-8">
        <div className="mx-auto grid max-w-6xl min-w-0 gap-5">
          <ShellHeader
            eyebrow="Partner Portal"
            title="제휴처 추가"
            description={`${companyName}에 연결할 새 제휴처 또는 지점을 신청합니다. 제출 후 관리자가 검토합니다.`}
            actions={
              <PartnerPendingButtonLink
                href={getCompanyScopedPortalHref(companyId)}
                variant="secondary"
              >
                대시보드로 돌아가기
              </PartnerPendingButtonLink>
            }
          />

          <PartnerRegistrationClient
            categories={categories}
            brandProfiles={brandProfiles}
            webAction={webAction}
            showExcelTab={false}
            lockCompanyName
            titleBadge="파트너 포털 신청"
            submitLabel="제휴처 추가 신청"
            submitPendingLabel="신청 중"
            hiddenFields={{ companyId }}
            initialValues={{
              companyName,
              companyDescription: companyDescription ?? "",
              contactName: displayName,
              contactEmail,
            }}
          />
        </div>
      </Container>
    </div>
  );
}
