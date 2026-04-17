import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import SectionHeading from "@/components/ui/SectionHeading";
import PartnerAccountCreateForm from "@/components/admin/partner-account-manager/PartnerAccountCreateForm";
import PartnerAccountCard from "@/components/admin/partner-account-manager/PartnerAccountCard";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function AdminPartnerAccountManagerContent({
  accounts,
  companies,
}: {
  accounts: AdminPartnerAccount[];
  companies: {
    id: string;
    name: string;
    slug: string;
  }[];
}) {
  return (
    <div className="grid gap-4">
      <PartnerAccountCreateForm companies={companies} />
      {accounts.length === 0 ? (
        <EmptyState
          title="협력사 계정이 없습니다."
          description="위 폼으로 새 계정을 추가하면 이곳에 목록이 나타납니다."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading
              title="계정 목록"
              description="계정 정보 수정과 협력사 연결 관리를 각 카드에서 바로 처리합니다."
            />
            <Badge variant="neutral">{accounts.length}개</Badge>
          </div>
          {accounts.map((account) => (
            <PartnerAccountCard
              key={account.id}
              account={account}
              companies={companies}
            />
          ))}
        </>
      )}
    </div>
  );
}
