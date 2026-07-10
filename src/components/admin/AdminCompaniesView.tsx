import AdminCompanyWorkspace, {
  type AdminCompanyWorkspaceProps,
} from "@/components/admin/AdminCompanyWorkspace";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";

export default function AdminCompaniesView({
  companies,
  accounts,
  partnerCount,
  errorMessage,
  generatedSetupUrl,
  generatedSetupAccountId,
  initialTab,
  actions,
}: AdminCompanyWorkspaceProps & {
  partnerCount: number;
  errorMessage?: string | null;
}) {
  const activeCompanyCount = companies.filter(
    (company) => company.is_active !== false,
  ).length;
  const activeAccountCount = accounts.filter(
    (account) => account.is_active !== false,
  ).length;
  const totalAccountLinks = accounts.reduce(
    (sum, account) => sum + account.links.length,
    0,
  );

  return (
    <section className="grid gap-6">
      <AdminPageHeader
        eyebrow="Partner Companies"
        title="파트너사와 계정 연결 관리"
        description="여러 제휴처를 보유한 회사 단위, 담당 계정, 다대다 연결을 한 화면에서 정리합니다."
      />
      {errorMessage ? (
        <FormMessage variant="error">{errorMessage}</FormMessage>
      ) : null}
      <StatsRow
        items={[
          {
            label: "파트너사",
            value: `${companies.length}개`,
            hint: `활성 ${activeCompanyCount}개`,
          },
          {
            label: "제휴처",
            value: `${partnerCount}개`,
            hint: "파트너사에 연결된 전체 제휴처",
          },
          {
            label: "계정",
            value: `${accounts.length}개`,
            hint: `활성 ${activeAccountCount}개`,
          },
          {
            label: "연결",
            value: `${totalAccountLinks}건`,
            hint: "계정과 파트너사 전체 연결 수",
          },
        ]}
        minItemWidth="13rem"
      />

      <AdminCompanyWorkspace
        companies={companies}
        accounts={accounts}
        generatedSetupUrl={generatedSetupUrl}
        generatedSetupAccountId={generatedSetupAccountId}
        initialTab={initialTab}
        actions={actions}
      />
    </section>
  );
}
