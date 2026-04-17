import EmptyState from "@/components/ui/EmptyState";
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
  if (accounts.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          title="협력사 계정이 없습니다."
          description="협력사를 추가하면 담당자 계정이 함께 나타납니다."
        />
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {accounts.map((account) => (
        <PartnerAccountCard
          key={account.id}
          account={account}
          companies={companies}
        />
      ))}
    </div>
  );
}
