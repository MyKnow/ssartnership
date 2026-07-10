import AdminDashboardView, {
  type AdminDashboardQueueCounts,
} from "@/components/admin/AdminDashboardView";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import {
  countScopedAdminRegistrationRows,
  type AdminRegistrationScopeRow,
} from "@/lib/admin-dashboard-scope";
import {
  getManagedCampusFilterValues,
  isRegionalAdminAccount,
  type AdminScopeAccountLike,
} from "@/lib/admin-scope";
import { getAdminSession } from "@/lib/auth";
import { createEmptyAdminPermissionMatrix } from "@/lib/admin-permissions";
import { collectPagedRows } from "@/lib/log-insights/paging";
import { fetchAdminDashboardCounts } from "@/lib/partner-counts";
import {
  getSsafyCycleOverview,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EMPTY_QUEUE_COUNTS: AdminDashboardQueueCounts = {
  registrationPendingCount: 0,
  changeRequestPendingCount: 0,
  planRequestPendingCount: 0,
  unreadNotificationCount: 0,
};

type AdminSupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

async function loadPendingRegistrationCount(
  supabase: AdminSupabaseClient,
  account: AdminScopeAccountLike,
) {
  const managedCampusFilter = getManagedCampusFilterValues(account);
  if (managedCampusFilter === null) {
    const result = await supabase
      .from("partner_registration_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_review"]);
    return result.error ? 0 : result.count ?? 0;
  }
  if (managedCampusFilter.length === 0) {
    return 0;
  }

  const result = await collectPagedRows<AdminRegistrationScopeRow>(
    null,
    async (from, to) => {
      const pageResult = await supabase
        .from("partner_registration_requests")
        .select("location,company:partner_companies(managed_campus_slugs)")
        .in("status", ["pending", "in_review"])
        .range(from, to);

      return {
        rows: (pageResult.data ?? []) as AdminRegistrationScopeRow[],
        error: !!pageResult.error,
      };
    },
  );

  return result.partialFailure
    ? 0
    : countScopedAdminRegistrationRows(account, result.rows);
}

async function loadScopedPartnerIds(
  supabase: AdminSupabaseClient,
  managedCampusFilter: string[] | null,
) {
  if (managedCampusFilter === null) {
    return null;
  }
  if (managedCampusFilter.length === 0) {
    return [];
  }

  const partnerResult = await collectPagedRows<{ id: string }>(
    null,
    async (from, to) => {
      const pageResult = await supabase
        .from("partners")
        .select("id")
        .overlaps("managed_campus_slugs", managedCampusFilter)
        .range(from, to);

      return {
        rows: pageResult.data ?? [],
        error: !!pageResult.error,
      };
    },
  );
  if (partnerResult.partialFailure) {
    return [];
  }

  return partnerResult.rows.map((partner) => partner.id);
}

async function loadPendingChangeRequestCount(
  supabase: AdminSupabaseClient,
  scopedPartnerIds: string[] | null,
) {
  if (scopedPartnerIds === null) {
    const result = await supabase
      .from("partner_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return result.error ? 0 : result.count ?? 0;
  }

  if (scopedPartnerIds.length === 0) {
    return 0;
  }

  const result = await supabase
    .from("partner_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .in("partner_id", scopedPartnerIds);
  return result.error ? 0 : result.count ?? 0;
}

async function loadPendingPlanRequestCount(
  supabase: AdminSupabaseClient,
  includeGlobalTasks: boolean,
) {
  if (!includeGlobalTasks) {
    return 0;
  }

  const result = await supabase
    .from("partner_plan_upgrade_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return result.error ? 0 : result.count ?? 0;
}

export default async function AdminPage() {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseEnv) {
    return (
      <AdminShell title="관리 홈">
        <div className="grid gap-6">
          <AdminPageHeader
            eyebrow="Operations"
            title="관리 홈"
            description="운영 데이터를 불러오려면 서버 환경 설정이 필요합니다."
          />
          <Card className="w-full max-w-xl text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Supabase 설정이 필요합니다.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 설정한 뒤 다시 접속해
              주세요.
            </p>
          </Card>
        </div>
      </AdminShell>
    );
  }

  const supabase = getSupabaseAdminClient();
  const [cycleSettings, dashboardCountResult, adminSession] = await Promise.all([
    getSsafyCycleSettings(),
    fetchAdminDashboardCounts(supabase),
    getAdminSession(),
  ]);
  const cycleOverview = getSsafyCycleOverview(cycleSettings);

  let dashboardCounts = dashboardCountResult.errorMessage
    ? {
        memberCount: 0,
        companyCount: 0,
        partnerCount: 0,
        categoryCount: 0,
        accountCount: 0,
        reviewCount: 0,
        activePushSubscriptionCount: 0,
        productLogCount: 0,
        auditLogCount: 0,
        securityLogCount: 0,
      }
    : dashboardCountResult.counts;

  let queueCounts = EMPTY_QUEUE_COUNTS;
  if (adminSession) {
    const includeGlobalTasks = !isRegionalAdminAccount(adminSession.account);
    const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
    const scopedPartnerIds = await loadScopedPartnerIds(
      supabase,
      managedCampusFilter,
    );
    if (scopedPartnerIds !== null) {
      dashboardCounts = {
        ...dashboardCounts,
        partnerCount: scopedPartnerIds.length,
      };
    }
    const [
      registrationPendingCount,
      changeRequestPendingCount,
      planRequestPendingCount,
      unreadResult,
    ] = await Promise.all([
      loadPendingRegistrationCount(supabase, adminSession.account),
      loadPendingChangeRequestCount(supabase, scopedPartnerIds),
      loadPendingPlanRequestCount(supabase, includeGlobalTasks),
      supabase
        .from("admin_notification_recipients")
        .select("id", { count: "exact", head: true })
        .eq("admin_id", adminSession.adminId)
        .is("deleted_at", null)
        .is("read_at", null),
    ]);

    queueCounts = {
      registrationPendingCount,
      changeRequestPendingCount,
      planRequestPendingCount,
      unreadNotificationCount: unreadResult.error ? 0 : unreadResult.count ?? 0,
    };
  }

  const cycleMeta = cycleSettings.manualCurrentYear
    ? `${cycleOverview.currentYear}기 · 조기 시작`
    : `${cycleOverview.currentYear}기 · ${cycleOverview.currentSemester}학기`;

  return (
    <AdminShell title="관리 홈">
      <AdminDashboardView
        counts={dashboardCounts}
        queueCounts={queueCounts}
        permissions={
          adminSession?.account.permissions ?? createEmptyAdminPermissionMatrix()
        }
        cycleMeta={cycleMeta}
        includeGlobalTasks={
          adminSession ? !isRegionalAdminAccount(adminSession.account) : false
        }
      />
    </AdminShell>
  );
}
