import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import PartnerChangeRequestQueue from "@/components/admin/PartnerChangeRequestQueue";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";
import {
  approvePartnerChangeRequest,
  rejectPartnerChangeRequest,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { listPartnerChangeRequests } from "@/lib/partner-change-requests";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

export default async function AdminPartnerRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
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
  const errorMessage = params.error ? errorMessages[params.error] ?? null : null;

  return (
    <AdminShell title="변경 요청" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="Partner Requests"
          title="제휴처 변경 요청"
          description="파트너사 담당자가 요청한 변경 항목을 현재 값과 비교해 승인하거나 거절합니다."
          actions={
            <Button href="/admin/partners" variant="secondary">
              제휴처 목록
            </Button>
          }
        />
        <StatsRow
          items={[
            { label: "승인 대기", value: `${scopedRequests.length.toLocaleString("ko-KR")}건`, hint: "현재 처리할 요청" },
            { label: "제휴처", value: `${partnerCount.toLocaleString("ko-KR")}개`, hint: "요청이 연결된 제휴처" },
            { label: "파트너사", value: `${companyCount.toLocaleString("ko-KR")}개`, hint: "요청을 보낸 계약 회사" },
            { label: "가장 오래된 요청", value: oldestCreatedAt ? formatKoreanDateTimeToMinute(oldestCreatedAt) : "-", hint: "오래된 요청부터 검토" },
          ]}
          minItemWidth="13rem"
        />
        {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
        <PartnerChangeRequestQueue
          requests={scopedRequests}
          approveAction={approvePartnerChangeRequest}
          rejectAction={rejectPartnerChangeRequest}
          canReview={canAdmin(adminSession.account.permissions, "brands", "update")}
        />
      </div>
    </AdminShell>
  );
}
