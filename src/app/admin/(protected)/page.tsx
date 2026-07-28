import { Suspense } from "react";
import AdminDashboardView, {
  AdminDashboardHeader,
} from "@/components/admin/AdminDashboardView";
import AdminDashboardPlatformActivitySection from "@/components/admin/AdminDashboardPlatformActivitySection";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";
import {
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
import {
  AdminDashboardSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";

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

function AdminDashboardContent({
  adminSession,
}: {
  adminSession: Awaited<ReturnType<typeof getAdminSession>>;
}) {
  const cycleSettingsPromise = getSsafyCycleSettings();
  const dashboardSnapshotPromise = adminSession
    ? getAdminDashboardHomeData({
        adminId: adminSession.adminId,
        account: adminSession.account,
      })
    : Promise.resolve({
        snapshot: toAdminDashboardHomeSnapshot(),
        hasError: false,
      });
  return (
    <AdminDashboardData
      adminSession={adminSession}
      cycleSettingsPromise={cycleSettingsPromise}
      dashboardSnapshotPromise={dashboardSnapshotPromise}
    />
  );
}

async function AdminDashboardData({
  adminSession,
  cycleSettingsPromise,
  dashboardSnapshotPromise,
}: {
  adminSession: Awaited<ReturnType<typeof getAdminSession>>;
  cycleSettingsPromise: ReturnType<typeof getSsafyCycleSettings>;
  dashboardSnapshotPromise: ReturnType<typeof getAdminDashboardHomeData> | Promise<{
    snapshot: ReturnType<typeof toAdminDashboardHomeSnapshot>;
    hasError: boolean;
  }>;
}) {
  const dashboardSnapshotResult = await dashboardSnapshotPromise;
  const includeGlobalTasks = adminSession
    ? !isRegionalAdminAccount(adminSession.account)
    : false;
  const canViewPlatformActivity =
    !!adminSession &&
    includeGlobalTasks &&
    canAdmin(adminSession.account.permissions, "logs", "read");

  const cycleMeta = (
    <Suspense
      fallback={
        <span role="status" aria-label="기수 설정을 확인하는 중">
          확인 중
        </span>
      }
    >
      <AdminDashboardCycleMeta settingsPromise={cycleSettingsPromise} />
    </Suspense>
  );

  return (
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
      showHeader={false}
    />
  );
}

async function AdminDashboardCycleMeta({
  settingsPromise,
}: {
  settingsPromise: ReturnType<typeof getSsafyCycleSettings>;
}) {
  let cycleMeta: string | null = null;
  try {
    const settings = await settingsPromise;
    const cycleOverview = getSsafyCycleOverview(settings);
    cycleMeta = settings.manualCurrentYear
      ? `${cycleOverview.currentYear}기 · 조기 시작`
      : `${cycleOverview.currentYear}기 · ${cycleOverview.currentSemester}학기`;
  } catch {
    cycleMeta = null;
  }

  return cycleMeta ? (
    <>{cycleMeta}</>
  ) : (
    <span role="status" aria-label="기수 설정을 확인하지 못함">
      확인 불가
    </span>
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
            eyebrow="홈"
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

  const adminSession = await getAdminSession();

  return (
    <AdminShell title="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminDashboardHeader />
        <Suspense fallback={<AdminDashboardSkeletonContent showHeader={false} />}>
          <AdminDashboardContent adminSession={adminSession} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
