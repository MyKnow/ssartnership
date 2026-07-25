import AdminShell from "@/components/admin/AdminShell";
import AdminTaskInboxView from "@/components/admin/AdminTaskInboxView";
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroupsByPermissions,
} from "@/components/admin/admin-navigation";
import { getAdminSession } from "@/lib/auth";
import { isRegionalAdminAccount } from "@/lib/admin-scope";
import {
  getAdminTaskQueueCounts,
  prioritizeAdminTaskItems,
} from "@/lib/admin-task-inbox";

export default async function AdminTasksPage() {
  const session = await getAdminSession();
  const taskGroup = session
    ? filterAdminNavGroupsByPermissions(
        ADMIN_NAV_GROUPS,
        session.account.permissions,
        { includeGlobalItems: !isRegionalAdminAccount(session.account) },
      ).find((group) => group.label === "작업함")
    : undefined;

  const tasks = (taskGroup?.items ?? []).filter(
    (item) => item.href !== "/admin/tasks",
  );
  const queueCounts = session
    ? await getAdminTaskQueueCounts({
        adminId: session.adminId,
        account: session.account,
      })
    : {};

  return (
    <AdminShell title="작업함" backHref="/admin" backLabel="관리 홈">
      <AdminTaskInboxView
        tasks={prioritizeAdminTaskItems(tasks, queueCounts)}
        queueCounts={queueCounts}
      />
    </AdminShell>
  );
}
