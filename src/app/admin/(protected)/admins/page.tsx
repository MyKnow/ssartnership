import { Suspense } from "react";
import AdminAccountsView from "@/components/admin/AdminAccountsView";
import AdminShell from "@/components/admin/AdminShell";
import { AdminAccountsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import {
  applyAdminPermissionTemplate,
  grantMemberAdminPermission,
  updateAdminAccountStatus,
} from "@/app/admin/(protected)/actions";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  listAdminAccounts,
  listAdminPermissionTemplates,
} from "@/lib/admin-accounts";
import { getAdminAccountFeedback } from "@/lib/admin-account-feedback";
import { canAdmin } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

async function AdminAccountsContent({
  adminSession,
  status,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  status?: string;
}) {
  let accounts: Awaited<ReturnType<typeof listAdminAccounts>> = [];
  let loadError = false;
  try {
    accounts = await listAdminAccounts();
  } catch {
    loadError = true;
  }
  const templates = listAdminPermissionTemplates();
  const feedback = getAdminAccountFeedback(status);

  return (
    <AdminAccountsView
        accounts={accounts}
        templates={templates}
        feedback={feedback?.message}
        feedbackIsError={feedback?.tone === "error"}
        loadError={loadError}
        canGrant={canAdmin(
          adminSession.account.permissions,
          "admin_management",
          "create",
        )}
        canUpdate={canAdmin(
          adminSession.account.permissions,
          "admin_management",
          "update",
        )}
        canDelete={canAdmin(
          adminSession.account.permissions,
          "admin_management",
          "delete",
        )}
        grantAction={grantMemberAdminPermission}
        applyTemplateAction={applyAdminPermissionTemplate}
        updateStatusAction={updateAdminAccountStatus}
    />
  );
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminPermission(
    "admin_management",
    "read",
    {
      path: "/admin/admins",
    },
  );
  const params = (await searchParams) ?? {};
  const status = typeof params.status === "string" ? params.status : undefined;

  return (
    <AdminShell title="관리자 관리" backHref="/admin" backLabel="관리 홈">
      <Suspense fallback={<AdminAccountsSkeletonContent />}>
        <AdminAccountsContent adminSession={adminSession} status={status} />
      </Suspense>
    </AdminShell>
  );
}
