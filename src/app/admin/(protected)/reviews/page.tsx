import { Suspense } from "react";
import AdminReviewManager from "@/components/admin/AdminReviewManager";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminReviewsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import {
  getAdminReviewPageData,
  parseAdminReviewFilters,
  parseAdminReviewPagination,
  serializeAdminReviewPageQuery,
} from "@/lib/admin-reviews";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";

export const dynamic = "force-dynamic";

const adminReviewsErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

async function AdminReviewsContent({
  adminSession,
  params,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = parseAdminReviewFilters(params);
  const pagination = parseAdminReviewPagination(params);
  const errorMessage =
    typeof params.error === "string"
      ? (adminReviewsErrorMessages[params.error] ?? null)
      : null;
  const data = await getAdminReviewPageData(filters, {
    managedCampusSlugs: getManagedCampusFilterValues(adminSession.account),
    ...pagination,
  });
  const queryString = serializeAdminReviewPageQuery(filters, pagination);
  const returnTo = queryString
    ? `/admin/reviews?${queryString}`
    : "/admin/reviews";
  const canUpdate = canAdmin(
    adminSession.account.permissions,
    "reviews",
    "update",
  );
  const canDelete = canAdmin(
    adminSession.account.permissions,
    "reviews",
    "delete",
  );

  return (
    <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="데이터"
          title="리뷰 관리"
          description="회원 리뷰를 검토하고 공개 상태와 삭제를 관리합니다."
        />
        <AdminReviewManager
          data={data}
          returnTo={returnTo}
          errorMessage={errorMessage}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
    </div>
  );
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminPermission("reviews", "read", {
    path: "/admin/reviews",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="리뷰 관리" backHref="/admin" backLabel="관리 홈">
      <Suspense fallback={<AdminReviewsSkeletonContent />}>
        <AdminReviewsContent adminSession={adminSession} params={params} />
      </Suspense>
    </AdminShell>
  );
}
