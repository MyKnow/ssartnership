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

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("admin_management", "read", {
    path: "/admin/admins",
  });
  const params = (await searchParams) ?? {};
  const status = typeof params.status === "string" ? params.status : undefined;
  const [accounts, templates] = await Promise.all([
    listAdminAccounts(),
    Promise.resolve(listAdminPermissionTemplates()),
  ]);
  const feedback = getAdminAccountFeedback(status);

  return (
    <AdminShell title="관리자 관리" backHref="/admin" backLabel="관리 홈">
      <AdminAccountsView
        accounts={accounts}
        templates={templates}
        feedback={feedback?.message}
        feedbackIsError={feedback?.tone === "error"}
        grantAction={grantMemberAdminPermission}
        applyTemplateAction={applyAdminPermissionTemplate}
        updateStatusAction={updateAdminAccountStatus}
      />
    </AdminShell>
  );
}
