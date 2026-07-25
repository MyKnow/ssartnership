import AdminShell from "@/components/admin/AdminShell";
import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import PartnerChangeRequestQueue from "@/components/admin/PartnerChangeRequestQueue";
import Button from "@/components/ui/Button";
import {
  approvePartnerChangeRequest,
  rejectPartnerChangeRequest,
} from "@/app/admin/(protected)/actions";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { listPartnerChangeRequests } from "@/lib/partner-change-requests";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPartnerRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partner-requests",
  });
  const params = (await searchParams) ?? {};
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const requests = await listPartnerChangeRequests();
  let scopedRequests = requests;

  if (managedCampusFilter) {
    const supabase = getSupabaseAdminClient();
    const partnersResult = await supabase
      .from("partners")
      .select("id")
      .overlaps("managed_campus_slugs", managedCampusFilter);

    if (partnersResult.error) {
      throw new Error(`partner scope load failed: ${partnersResult.error.message}`);
    }

    const scopedPartnerIds = new Set(
      (partnersResult.data ?? []).map((partner) => partner.id),
    );
    scopedRequests = requests.filter((request) =>
      scopedPartnerIds.has(request.partnerId),
    );
  }

  const partnerCount = new Set(
    scopedRequests.map((request) => request.partnerId),
  ).size;
  const companyCount = new Set(
    scopedRequests.map((request) => request.companyId),
  ).size;
  const oldestCreatedAt = scopedRequests.reduce<string | null>(
    (oldest, request) =>
      !oldest || new Date(request.createdAt).getTime() < new Date(oldest).getTime()
        ? request.createdAt
        : oldest,
    null,
  );
  const feedback = getAdminReviewQueueFeedback({
    error: params.error,
    success: params.success,
  });
  const returnTo = "/admin/partner-requests";

  return (
    <AdminShell title="변경 요청" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <AdminReviewQueueHeader
          eyebrow="Partner Requests"
          title="제휴처 변경 요청"
          description="파트너사 담당자가 요청한 변경 항목을 현재 값과 비교해 승인하거나 거절합니다."
          actions={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록
            </Button>
          }
          metrics={[
            { label: "승인 대기", value: `${scopedRequests.length.toLocaleString("ko-KR")}건`, hint: "현재 처리할 요청" },
            { label: "제휴처", value: `${partnerCount.toLocaleString("ko-KR")}개`, hint: "요청이 연결된 제휴처" },
            { label: "파트너사", value: `${companyCount.toLocaleString("ko-KR")}개`, hint: "요청을 보낸 계약 회사" },
            { label: "가장 오래된 요청", value: oldestCreatedAt ? formatKoreanDateTimeToMinute(oldestCreatedAt) : "-", hint: "오래된 요청부터 검토" },
          ]}
          feedback={feedback}
          nextAction={{
            title: "변경된 항목만 비교한 뒤 승인 또는 거절하세요.",
            description: "오래된 요청부터 처리하면 파트너사 화면에 반영되지 않은 변경 사항이 쌓이는 일을 줄일 수 있습니다.",
          }}
        />
        <PartnerChangeRequestQueue
          requests={scopedRequests}
          approveAction={approvePartnerChangeRequest}
          rejectAction={rejectPartnerChangeRequest}
          canReview={canAdmin(adminSession.account.permissions, "brands", "update")}
          returnTo={returnTo}
        />
      </div>
    </AdminShell>
  );
}
