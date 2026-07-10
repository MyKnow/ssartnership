import PartnerPlanManagementView, {
  type PartnerPlanActions,
} from "@/components/partner/PartnerPlanManagementView";
import Container from "@/components/ui/Container";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import type { PartnerBillingProfileRecord } from "@/lib/partner-billing-profiles";
import type { PartnerBankTransferAccount } from "@/lib/partner-billing-config";
import type { PartnerPlanPortalData } from "@/lib/partner-plan-service";

export type PartnerPlanScreenProps = {
  companyId: string;
  companyName: string;
  data: PartnerPlanPortalData;
  bankTransferAccount: PartnerBankTransferAccount;
  billingProfiles: PartnerBillingProfileRecord[];
  actions: PartnerPlanActions;
  statusMessage?: string | null;
  errorMessage?: string | null;
};

export default function PartnerPlanScreen({
  companyId,
  companyName,
  data,
  bankTransferAccount,
  billingProfiles,
  actions,
  statusMessage = null,
  errorMessage = null,
}: PartnerPlanScreenProps) {
  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="플랜 관리"
          description={`${companyName} 소유 제휴처의 플랜과 업그레이드 요청 상태를 확인합니다.`}
        />
        {statusMessage ? (
          <FormMessage variant="info">{statusMessage}</FormMessage>
        ) : null}
        {errorMessage ? (
          <FormMessage variant="error">{errorMessage}</FormMessage>
        ) : null}
        <PartnerPlanManagementView
          data={data}
          companyId={companyId}
          bankTransferAccount={bankTransferAccount}
          billingProfiles={billingProfiles}
          actions={actions}
        />
      </div>
    </Container>
  );
}
