import { Suspense } from "react";
import AdminLogsManager from "@/components/admin/AdminLogsManager";
import AdminLogsAncillaryPanels, {
  AdminLogsAncillaryFallback,
} from "@/components/admin/AdminLogsAncillaryPanels";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { requireAdminPermission } from "@/lib/admin-access";
import { getAdminLogAccessPolicy } from "@/lib/admin-log-access";
import { getAdminLogsPageData } from "@/lib/log-insights";
import { fetchForwardActivityMetrics } from "@/lib/platform-activity-forward-metrics";
import { getAdminWebVitalSummary } from "@/lib/admin-web-vitals-summary.server";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const session = await requireAdminPermission("logs", "read", {
    path: "/admin/logs",
  });
  const access = getAdminLogAccessPolicy(session.account);
  const activityPromise = fetchForwardActivityMetrics();
  const webVitalsPromise = getAdminWebVitalSummary();
  const data = await getAdminLogsPageData({ preset: "24h" }, access);

  return (
    <AdminShell title="로그 조회" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="운영 기록"
          title="운영 로그 조회"
          description="제품 이벤트, 관리자 감사, 인증 보안 로그를 공통 탐색 규칙으로 확인합니다."
        />
        <AdminLogsManager initialData={data} />
        <Suspense fallback={<AdminLogsAncillaryFallback />}>
          <AdminLogsAncillaryPanels
            activity={activityPromise}
            webVitals={webVitalsPromise}
          />
        </Suspense>
      </div>
    </AdminShell>
  );
}
