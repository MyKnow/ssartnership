import { headers } from "next/headers";
import { requireAdminPageAccess } from "@/lib/admin-access";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";
import { getForwardedRequestPath } from "@/lib/request-path";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const returnTo = sanitizeAdminReturnTo(
    getForwardedRequestPath(headerStore),
    "/admin",
  );
  await requireAdminPageAccess(returnTo);
  return children;
}
