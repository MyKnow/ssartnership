import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import PartnerAccountCreateForm from "@/components/admin/partner-account-manager/PartnerAccountCreateForm";
import PartnerAccountCard from "@/components/admin/partner-account-manager/PartnerAccountCard";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function AdminPartnerAccountManagerContent({
  accounts,
  companies,
  generatedSetupUrl,
  generatedSetupAccountId,
}: {
  accounts: AdminPartnerAccount[];
  companies: {
    id: string;
    name: string;
    slug: string;
  }[];
  generatedSetupUrl?: string | null;
  generatedSetupAccountId?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:items-start xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
      <aside className="md:sticky md:top-24 md:order-2">
        <PartnerAccountCreateForm companies={companies} />
      </aside>

      <section className="grid min-w-0 gap-4 md:order-1">
        {accounts.length === 0 ? (
          <Card tone="elevated" padding="md">
            <EmptyState
              title="협력사 계정이 없습니다."
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
                generatedSetupAccountId === account.id ? generatedSetupUrl : null
              }
            />
          ))}
          </>
        )}
      </section>
    </div>
  );
}
