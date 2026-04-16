import PartnerAccountForm from "@/components/admin/partner-account-manager/PartnerAccountForm";
import PartnerAccountHeader from "@/components/admin/partner-account-manager/PartnerAccountHeader";
import PartnerAccountLinks from "@/components/admin/partner-account-manager/PartnerAccountLinks";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function PartnerAccountCard({
  account,
}: {
  account: AdminPartnerAccount;
}) {
  const accountFormId = `partner-account-form-${account.id}`;

  return (
    <article className="rounded-3xl border border-border bg-surface-elevated p-4 shadow-sm">
      <PartnerAccountHeader account={account} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <PartnerAccountForm account={account} formId={accountFormId} />
        <PartnerAccountLinks account={account} />
      </div>
    </article>
  );
}
