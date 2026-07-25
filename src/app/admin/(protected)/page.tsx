import { Suspense } from "react";
import AdminDashboardView from "@/components/admin/AdminDashboardView";
import AdminDashboardPlatformActivitySection from "@/components/admin/AdminDashboardPlatformActivitySection";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";
import {
  getManagedCampusFilterValues,
  isRegionalAdminAccount,
} from "@/lib/admin-scope";
import { getAdminSession } from "@/lib/auth";
import { canAdmin, createEmptyAdminPermissionMatrix } from "@/lib/admin-permissions";
import {
  toAdminDashboardHomeSnapshot,
} from "@/lib/partner-counts";
import { getAdminDashboardHomeData } from "@/lib/admin-dashboard-home.server";
import {
  getSsafyCycleOverview,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";

export const dynamic = "force-dynamic";

function AdminPlatformActivityFallback() {
  return (
    <Surface
      level="default"
      padding="lg"
      aria-busy="true"
      aria-label="서비스 활성 지표를 불러오는 중"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-3 h-4 max-w-xl" />
    </Surface>
  );
}

export default async function AdminPage() {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseEnv) {
    return (
      <AdminShell title="관리 홈">
        <div className="grid gap-6">
          <AdminPageHeader
            eyebrow="운영"
            title="관리 홈"
            description="운영 정보를 준비하지 못했습니다. 잠시 후 다시 확인해 주세요."
          />
          <Card className="w-full max-w-xl text-center">
            <h2 className="text-xl font-semibold text-foreground">
              운영 정보를 준비하지 못했습니다.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              잠시 후 다시 시도해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요.
            </p>
          </Card>
        </div>
      </AdminShell>
    );
  }

  const cycleSettingsPromise = getSsafyCycleSettings();
  const adminSession = await getAdminSession();
  const dashboardSnapshotPromise = adminSession
    ? getAdminDashboardHomeData({
        adminId: adminSession.adminId,
        managedCampusSlugs: getManagedCampusFilterValues(adminSession.account),
      })
    : Promise.resolve({
        snapshot: toAdminDashboardHomeSnapshot(),
        hasError: false,
      });
  const [cycleSettings, dashboardSnapshotResult] = await Promise.all([
    cycleSettingsPromise,
    dashboardSnapshotPromise,
  ]);
  const cycleOverview = getSsafyCycleOverview(cycleSettings);
  const includeGlobalTasks = adminSession
    ? !isRegionalAdminAccount(adminSession.account)
    : false;
  const canViewPlatformActivity =
    !!adminSession &&
    includeGlobalTasks &&
    canAdmin(adminSession.account.permissions, "logs", "read");

  const cycleMeta = cycleSettings.manualCurrentYear
    ? `${cycleOverview.currentYear}기 · 조기 시작`
    : `${cycleOverview.currentYear}기 · ${cycleOverview.currentSemester}학기`;

  return (
    <AdminShell title="관리 홈">
      <AdminDashboardView
        counts={dashboardSnapshotResult.snapshot.counts}
        queueCounts={dashboardSnapshotResult.snapshot.queueCounts}
        permissions={
          adminSession?.account.permissions ?? createEmptyAdminPermissionMatrix()
        }
        cycleMeta={cycleMeta}
        includeGlobalTasks={includeGlobalTasks}
        isDataUnavailable={dashboardSnapshotResult.hasError}
        platformActivity={
          canViewPlatformActivity ? (
            <Suspense fallback={<AdminPlatformActivityFallback />}>
              <AdminDashboardPlatformActivitySection />
            </Suspense>
          ) : null
        }
      />
    </AdminShell>
  );
}
