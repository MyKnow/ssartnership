import { headers } from "next/headers";
import { requireAdminPageAccess } from "@/lib/admin-access";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const returnTo = sanitizeAdminReturnTo(headerStore.get("next-url"), "/admin");
  await requireAdminPageAccess(returnTo);
  return children;
}
