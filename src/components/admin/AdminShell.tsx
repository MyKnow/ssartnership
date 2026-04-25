import { logout } from "@/app/admin/(protected)/actions";
import AdminShellView from "./AdminShellView";

export default function AdminShell({
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
  return (
    <AdminShellView
      title={title}
      backHref={backHref}
      backLabel={backLabel}
      logoutAction={logout}
    >
      {children}
    </AdminShellView>
  );
}
