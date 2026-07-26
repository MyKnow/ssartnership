import AdminShell from "@/components/admin/AdminShell";
import AdminCompaniesView from "@/components/admin/AdminCompaniesView";
import {
  createPartnerAccount,
  createPartnerAccountInitialSetupUrl,
  createPartnerCompany,
  deletePartnerCompany,
  sendPartnerAccountInitialSetupUrl,
  updatePartnerAccount,
  updatePartnerAccountCompanyConnection,
  updatePartnerCompany,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminCompanyWorkspaceReadModel } from "@/lib/admin-company-workspace.server";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";

export const dynamic = "force-dynamic";

const adminCompaniesErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    generatedSetupUrl?: string;
    generatedSetupAccountId?: string;
    tab?: string;
  }>;
}) {
  const adminSession = await requireAdminPermission("companies", "read", {
    path: "/admin/companies",
  });
  const managedCampusFilter = getManagedCampusFilterValues(
    adminSession.account,
  );
  const params = (await searchParams) ?? {};
  const companyError = params.error
    ? adminCompaniesErrorMessages[params.error]
    : null;
  const generatedSetupUrl =
    typeof params.generatedSetupUrl === "string"
      ? params.generatedSetupUrl
      : null;
  const generatedSetupAccountId =
    typeof params.generatedSetupAccountId === "string"
      ? params.generatedSetupAccountId
      : null;
  const initialTab =
    params.tab === "accounts" || generatedSetupAccountId || generatedSetupUrl
      ? "accounts"
      : "companies";

  const readModel = await getAdminCompanyWorkspaceReadModel({
    managedCampusSlugs: managedCampusFilter,
    tab: initialTab,
  });

  return (
    <AdminShell
      title="파트너사/계정 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <AdminCompaniesView
        companies={readModel.companies}
        accounts={readModel.accounts}
        accountSummary={readModel.accountSummary}
        partnerCount={readModel.partnerCount}
        errorMessage={companyError}
        loadError={readModel.loadError}
        generatedSetupUrl={generatedSetupUrl}
        generatedSetupAccountId={generatedSetupAccountId}
        initialTab={initialTab}
        canCreate={canAdmin(
          adminSession.account.permissions,
          "companies",
          "create",
        )}
        canUpdate={canAdmin(
          adminSession.account.permissions,
          "companies",
          "update",
        )}
        canDelete={canAdmin(
          adminSession.account.permissions,
          "companies",
          "delete",
        )}
        actions={{
          createCompanyAction: createPartnerCompany,
          updateCompanyAction: updatePartnerCompany,
          deleteCompanyAction: deletePartnerCompany,
          updateConnectionAction: updatePartnerAccountCompanyConnection,
          createAccountAction: createPartnerAccount,
          updateAccountAction: updatePartnerAccount,
          createSetupUrlAction: createPartnerAccountInitialSetupUrl,
          sendSetupUrlAction: sendPartnerAccountInitialSetupUrl,
        }}
      />
    </AdminShell>
  );
}
