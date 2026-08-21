import type { Metadata } from "next";
import AdminAccessDeniedNotice from "@/components/admin/AdminAccessDeniedNotice";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `관리자 권한 없음 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminDeniedPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = sanitizeAdminReturnTo(params.returnTo);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <AdminAccessDeniedNotice returnTo={returnTo} />
    </div>
  );
}
