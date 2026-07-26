import AdminShell from "@/components/admin/AdminShell";
import { AdminTaskInboxStreamingView } from "@/components/admin/AdminTaskInboxView";
import {
  ADMIN_NAV_GROUPS,
  getAdminTaskItems,
  filterAdminNavGroupsByPermissions,
} from "@/components/admin/admin-navigation";
import { getAdminSession } from "@/lib/auth";
import { isRegionalAdminAccount } from "@/lib/admin-scope";
import { getAdminTaskQueueCounts } from "@/lib/admin-task-inbox";

export default async function AdminTasksPage() {
  const session = await getAdminSession();
  const visibleGroups = session
    ? filterAdminNavGroupsByPermissions(
        ADMIN_NAV_GROUPS,
        session.account.permissions,
        { includeGlobalItems: !isRegionalAdminAccount(session.account) },
      )
    : [];
  const tasks = getAdminTaskItems(visibleGroups);
  const queueCounts =
    session && tasks.length > 0
      ? getAdminTaskQueueCounts({
          adminId: session.adminId,
          account: session.account,
        })
      : null;

  return (
    <AdminShell title="작업함" backHref="/admin" backLabel="관리 홈">
      <AdminTaskInboxStreamingView tasks={tasks} queueCounts={queueCounts} />
    </AdminShell>
  );
}
