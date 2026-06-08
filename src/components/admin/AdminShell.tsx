import { logout } from "@/app/admin/(protected)/actions";
import { getAdminSession } from "@/lib/auth";
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroupsByPermissions,
} from "./admin-navigation";
import AdminShellView from "./AdminShellView";

export default async function AdminShell({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  const navGroups = session
    ? filterAdminNavGroupsByPermissions(
        ADMIN_NAV_GROUPS,
        session.account.permissions,
      )
    : ADMIN_NAV_GROUPS;

  return (
    <AdminShellView
      title={title}
      backHref={backHref}
      backLabel={backLabel}
      logoutAction={logout}
      navGroups={navGroups}
    >
      {children}
    </AdminShellView>
  );
}
