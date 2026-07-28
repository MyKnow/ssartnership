import AdminCompanyWorkspace, {
  type AdminCompanyWorkspaceProps,
} from "@/components/admin/AdminCompanyWorkspace";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminWorkspaceSummary from "@/components/admin/AdminWorkspaceSummary";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";

export default function AdminCompaniesView({
  companies,
  accounts,
  accountSummary,
  partnerCount,
  errorMessage,
  generatedSetupUrl,
  generatedSetupAccountId,
  initialTab,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  actions,
  loadError = false,
  showHeader = true,
}: AdminCompanyWorkspaceProps & {
  partnerCount: number;
  errorMessage?: string | null;
  loadError?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  showHeader?: boolean;
}) {
  const activeCompanyCount = companies.filter(
    (company) => company.is_active !== false,
  ).length;

  return (
    <section className="grid gap-6">
      {showHeader ? (
        <AdminPageHeader
          eyebrow="데이터"
          title="파트너사와 계정 연결 관리"
          description="여러 제휴처를 보유한 회사 단위, 담당 계정, 다대다 연결을 한 화면에서 정리합니다."
        />
      ) : null}
      {errorMessage ? (
        <FormMessage variant="error">{errorMessage}</FormMessage>
      ) : null}
      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="파트너사와 계정 정보를 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={
            <Button href="/admin/companies" variant="secondary">
              다시 확인
            </Button>
          }
        />
      ) : null}
      {!loadError ? (
        <>
          <AdminWorkspaceSummary
            eyebrow="데이터"
            title="파트너사 운영 현황"
            description="처리할 회사·계정 연결을 먼저 확인하고, 아래 탭에서 한 가지 작업을 이어갑니다."
            items={[
              {
                label: "파트너사",
                value: `${companies.length}개`,
                detail: `활성 ${activeCompanyCount}개`,
              },
              {
                label: "제휴처",
                value: `${partnerCount}개`,
                detail: "파트너사에 연결된 전체 제휴처",
              },
              {
                label: "계정",
                value: `${accountSummary.totalCount}개`,
                detail: `활성 ${accountSummary.activeCount}개`,
              },
              {
                label: "연결",
                value: `${accountSummary.totalLinks}건`,
                detail: "계정과 파트너사 전체 연결 수",
              },
            ]}
          />

          <AdminCompanyWorkspace
            companies={companies}
            accounts={accounts}
            generatedSetupUrl={generatedSetupUrl}
            generatedSetupAccountId={generatedSetupAccountId}
            initialTab={initialTab}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
            accountSummary={accountSummary}
            actions={actions}
          />
        </>
      ) : null}
    </section>
  );
}
