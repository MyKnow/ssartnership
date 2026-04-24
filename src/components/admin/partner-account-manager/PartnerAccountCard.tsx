import Card from "@/components/ui/Card";
import PartnerAccountForm from "@/components/admin/partner-account-manager/PartnerAccountForm";
import PartnerAccountHeader from "@/components/admin/partner-account-manager/PartnerAccountHeader";
import PartnerAccountLinks from "@/components/admin/partner-account-manager/PartnerAccountLinks";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function PartnerAccountCard({
  account,
  companies,
  generatedSetupUrl,
}: {
  account: AdminPartnerAccount;
  companies: {
    id: string;
    name: string;
    slug: string;
  }[];
  generatedSetupUrl?: string | null;
}) {
  const accountFormId = `partner-account-form-${account.id}`;

  return (
    <Card padding="md" className="grid gap-5">
      <PartnerAccountHeader account={account} generatedSetupUrl={generatedSetupUrl} />

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <PartnerAccountForm account={account} formId={accountFormId} />
        <PartnerAccountLinks account={account} companies={companies} />
      </div>
    </Card>
  );
}
