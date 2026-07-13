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

export const dynamic = "force-dynamic";

function statusMessage(status?: string, message?: string) {
  if (status === "granted" || status === "created") {
    return "회원에게 관리자 권한을 부여했습니다.";
  }
  if (status === "activated") return "관리자 권한을 활성화했습니다.";
  if (status === "revoked" || status === "deactivated") {
    return "관리자 권한을 회수했습니다.";
  }
  if (status === "permissions-updated") return "관리자 권한을 저장했습니다.";
  if (status === "template-applied") return "권한 템플릿을 적용했습니다.";
  if (status === "error") return message || "관리자 작업에 실패했습니다.";
  return null;
}

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
  const message = typeof params.message === "string" ? params.message : undefined;
  const [accounts, templates] = await Promise.all([
    listAdminAccounts(),
    Promise.resolve(listAdminPermissionTemplates()),
  ]);

  return (
    <AdminShell title="관리자 관리" backHref="/admin" backLabel="관리 홈">
      <AdminAccountsView
        accounts={accounts}
        templates={templates}
        feedback={statusMessage(status, message)}
        feedbackIsError={status === "error"}
        grantAction={grantMemberAdminPermission}
        applyTemplateAction={applyAdminPermissionTemplate}
        updateStatusAction={updateAdminAccountStatus}
      />
    </AdminShell>
  );
}
