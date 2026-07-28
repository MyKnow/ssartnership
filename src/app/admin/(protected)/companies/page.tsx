import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCompaniesView from "@/components/admin/AdminCompaniesView";
import { AdminCompaniesSkeletonContent } from "@/components/loading/AdminPageSkeletons";
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

async function AdminCompaniesContent({
  adminSession,
  params,
  initialTab,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: {
    error?: string;
    generatedSetupUrl?: string;
    generatedSetupAccountId?: string;
    tab?: string;
  };
  initialTab: "companies" | "accounts";
}) {
  const managedCampusFilter = getManagedCampusFilterValues(
    adminSession.account,
  );
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
  const readModel = await getAdminCompanyWorkspaceReadModel({
    managedCampusSlugs: managedCampusFilter,
    tab: initialTab,
  });

  return (
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
        showHeader={false}
      />
  );
}

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
  const params = (await searchParams) ?? {};
  const initialTab =
    params.tab === "accounts" || params.generatedSetupAccountId || params.generatedSetupUrl
      ? "accounts"
      : "companies";

  return (
    <AdminShell
      title="파트너사/계정 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="데이터"
          title="파트너사와 계정 연결 관리"
          description="여러 제휴처를 보유한 회사 단위, 담당 계정, 다대다 연결을 한 화면에서 정리합니다."
        />
        <Suspense fallback={<AdminCompaniesSkeletonContent showHeader={false} />}>
          <AdminCompaniesContent
            adminSession={adminSession}
            params={params}
            initialTab={initialTab}
          />
        </Suspense>
      </div>
    </AdminShell>
  );
}
