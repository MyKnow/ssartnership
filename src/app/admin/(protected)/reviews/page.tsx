import AdminReviewManager from "@/components/admin/AdminReviewManager";
import AdminShell from "@/components/admin/AdminShell";
import ShellHeader from "@/components/ui/ShellHeader";
import {
  adminActionErrorMessages,
} from "@/lib/admin-action-errors";
import {
  getAdminReviewPageData,
  parseAdminReviewFilters,
  serializeAdminReviewFilters,
} from "@/lib/admin-reviews";

export const dynamic = "force-dynamic";

const adminReviewsErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const filters = parseAdminReviewFilters(params);
  const errorMessage = typeof params.error === "string" ? adminReviewsErrorMessages[params.error] ?? null : null;
  const data = await getAdminReviewPageData(filters);
  const queryString = serializeAdminReviewFilters(filters);
  const returnTo = queryString ? `/admin/reviews?${queryString}` : "/admin/reviews";

  return (
    <AdminShell title="리뷰 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Reviews"
          title="리뷰 관리"
          description="회원 리뷰를 검토하고 공개 상태와 삭제를 관리합니다."
        />
        <AdminReviewManager data={data} returnTo={returnTo} errorMessage={errorMessage} />
      </div>
    </AdminShell>
  );
}
