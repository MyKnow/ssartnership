import { requireAdminPageAccess } from "@/lib/admin-access";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess("/admin");
  return children;
}
