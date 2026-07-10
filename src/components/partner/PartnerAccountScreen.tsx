import PartnerAccountInfoView, {
  type PartnerAccountInfoActions,
} from "@/components/partner/PartnerAccountInfoView";
import Container from "@/components/ui/Container";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import type { PartnerBillingProfileRecord } from "@/lib/partner-billing-profiles";

export type PartnerAccountScreenProps = {
  companyId: string;
  displayName: string;
  loginId: string;
  profiles: PartnerBillingProfileRecord[];
  actions: PartnerAccountInfoActions;
  statusMessage?: string | null;
  errorMessage?: string | null;
};

export default function PartnerAccountScreen({
  companyId,
  displayName,
  loginId,
  profiles,
  actions,
  statusMessage = null,
  errorMessage = null,
}: PartnerAccountScreenProps) {
  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="계정"
          description="담당자 계정, 비밀번호, 입금자와 세금계산서 정보를 모든 파트너사에 공통으로 관리합니다."
        />
        {statusMessage ? (
          <FormMessage variant="info">{statusMessage}</FormMessage>
        ) : null}
        {errorMessage ? (
          <FormMessage variant="error">{errorMessage}</FormMessage>
        ) : null}
        <PartnerAccountInfoView
          companyId={companyId}
          displayName={displayName}
          loginId={loginId}
          profiles={profiles}
          actions={actions}
        />
      </div>
    </Container>
  );
}
