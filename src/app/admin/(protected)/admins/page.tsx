import AdminAccountsView from "@/components/admin/AdminAccountsView";
import AdminShell from "@/components/admin/AdminShell";
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
    <AdminShell title="관리자 관리" backHref="/admin" backLabel="관리 홈">
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
    </AdminShell>
  );
}
