import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import Surface from "@/components/ui/Surface";
import PartnerAccountCreateForm from "@/components/admin/partner-account-manager/PartnerAccountCreateForm";
import PartnerAccountCard from "@/components/admin/partner-account-manager/PartnerAccountCard";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";
import type { AdminCompanyFormActions } from "@/components/admin/admin-form-actions";

export default function AdminPartnerAccountManagerContent({
  accounts,
  companies,
  generatedSetupUrl,
  generatedSetupAccountId,
  canCreate = false,
  canUpdate = false,
  actions,
}: {
  accounts: AdminPartnerAccount[];
  companies: {
    id: string;
    name: string;
    slug: string;
  }[];
  generatedSetupUrl?: string | null;
  generatedSetupAccountId?: string | null;
  canCreate?: boolean;
  canUpdate?: boolean;
  actions: AdminCompanyFormActions;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:items-start xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <aside className="md:sticky md:top-24 md:order-2">
        {canCreate ? (
          <PartnerAccountCreateForm
            companies={companies}
            createAccountAction={actions.createAccountAction}
          />
        ) : (
          <Surface level="inset" className="grid gap-2 p-4 sm:p-5">
            <p className="text-sm font-semibold text-foreground">
              파트너 계정 생성 권한이 없습니다.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              현재 계정은 담당 계정과 연결 현황을 확인할 수 있지만, 새 계정
              생성은 할 수 없습니다.
            </p>
          </Surface>
        )}
      </aside>

      <section className="grid min-w-0 gap-4 md:order-1">
        {accounts.length === 0 ? (
          <Card tone="elevated" padding="md">
            <EmptyState
              title="파트너사 계정이 없습니다."
              description="새 계정을 추가하면 이곳에서 연결과 초기 설정을 관리할 수 있습니다."
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading
                title="계정 목록"
                description="계정 상태를 먼저 훑고, 필요한 카드만 펼쳐 연결과 초기 설정을 처리합니다."
              />
              <Badge variant="neutral">{accounts.length}개</Badge>
            </div>
            {accounts.map((account) => (
              <PartnerAccountCard
                key={account.id}
                account={account}
                companies={companies}
                generatedSetupUrl={
                  generatedSetupAccountId === account.id
                    ? generatedSetupUrl
                    : null
                }
                actions={actions}
                canUpdate={canUpdate}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
