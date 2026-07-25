import AdminPlatformActivityMetricsPanel from "@/components/admin/AdminPlatformActivityMetricsPanel";
import InlineMessage from "@/components/ui/InlineMessage";
import { fetchAdminPlatformActivityMetrics } from "@/lib/platform-activity-metrics";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AdminDashboardPlatformActivitySection() {
  let result: Awaited<ReturnType<typeof fetchAdminPlatformActivityMetrics>> | null =
    null;

  try {
    result = await fetchAdminPlatformActivityMetrics(
      getSupabaseAdminClient(),
    );
  } catch {
    result = null;
  }

  if (!result || result.errorMessage) {
    return (
      <InlineMessage
        tone="warning"
        title="서비스 활성 지표를 불러오지 못했습니다."
        description="집계가 완료되면 이 영역에서 일간·주간·월간 활성 현황을 확인할 수 있습니다."
        actionHref="/admin"
        actionLabel="다시 확인"
      />
    );
  }

  return <AdminPlatformActivityMetricsPanel metrics={result.metrics} />;
}
