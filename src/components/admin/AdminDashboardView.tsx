import Link from "next/link";
import {
  BellAlertIcon,
  QueueListIcon,
  TagIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import InlineMessage from "@/components/ui/InlineMessage";
import Skeleton from "@/components/ui/Skeleton";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Surface from "@/components/ui/Surface";
import AdminPlatformActivityMetricsPanel from "@/components/admin/AdminPlatformActivityMetricsPanel";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import {
  type AdminPermissionMatrix,
  type AdminPermissionResource,
  canAdmin,
} from "@/lib/admin-permissions";
import type { AdminDashboardCounts } from "@/lib/partner-counts";
import type { AdminPlatformActivityMetrics } from "@/lib/platform-activity-metrics";

export type AdminDashboardQueueCounts = {
  registrationPendingCount: number;
  changeRequestPendingCount: number;
  planRequestPendingCount: number;
  unreadNotificationCount: number;
};

export type AdminDashboardViewState =
  | "ready"
  | "loading"
  | "error"
  | "unauthorized"
  | "forbidden";

type QueueItem = {
  href: string;
  label: string;
  description: string;
  count: number;
  permission: AdminPermissionResource;
};

type QuickAction = {
  href: string;
  label: string;
  description: string;
  meta: string;
  permission: AdminPermissionResource;
  icon: typeof UsersIcon;
};

type OperationItem = {
  label: string;
  value: string;
  description: string;
  permission: AdminPermissionResource;
  globalOnly?: boolean;
};

export default function AdminDashboardView({
  counts,
  queueCounts,
  permissions,
  cycleMeta,
  includeGlobalTasks = true,
  platformActivityMetrics,
  platformActivityErrorMessage,
  state = "ready",
  errorMessage,
}: {
  counts: AdminDashboardCounts;
  queueCounts: AdminDashboardQueueCounts;
  permissions: AdminPermissionMatrix;
  cycleMeta: string;
  includeGlobalTasks?: boolean;
  platformActivityMetrics?: AdminPlatformActivityMetrics | null;
  platformActivityErrorMessage?: string | null;
  state?: AdminDashboardViewState;
  errorMessage?: string;
}) {
  const errorDescription = errorMessage
    ? "운영 데이터를 다시 불러올 수 없습니다. 잠시 후 다시 확인해 주세요."
    : "잠시 후 다시 시도해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요.";

  if (state !== "ready") {
    return (
      <div className="grid min-w-0 gap-6" aria-busy={state === "loading" || undefined}>
        <AdminPageHeader
          eyebrow="Operations"
          title="관리 홈"
          description="처리가 필요한 항목부터 확인하고 자주 쓰는 운영 화면으로 이동합니다."
        />
        {state === "loading" ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
            {[0, 1].map((section) => (
              <Surface key={section} level={section === 0 ? "elevated" : "default"} padding="lg" className="grid gap-3">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
                {Array.from({ length: section === 0 ? 4 : 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                ))}
              </Surface>
            ))}
          </div>
        ) : state === "error" ? (
          <AdminStatePanel
            kind="error"
            title="관리 홈 데이터를 불러오지 못했습니다."
            description={errorDescription}
            action={<Button href="/admin" variant="secondary">다시 확인</Button>}
          />
        ) : (
          <Surface level="elevated" padding="lg" className="grid gap-4">
            <AdminStatePanel
              kind="forbidden"
              title={
                state === "unauthorized"
                  ? "관리자 로그인이 필요합니다."
                  : "이 관리 화면을 볼 권한이 없습니다."
              }
              description={
                state === "unauthorized"
                  ? "관리자 계정으로 로그인한 뒤 다시 시도해 주세요."
                  : "필요한 권한은 최고 관리자에게 요청해 주세요."
              }
              action={
                <Button
                  href={state === "unauthorized" ? "/auth/login?returnTo=%2Fadmin" : "/"}
                  variant="secondary"
                >
                  {state === "unauthorized" ? "관리자 로그인" : "사용자 홈으로"}
                </Button>
              }
            />
          </Surface>
        )}
      </div>
    );
  }

  const queueItems = ([
    {
      href: "/admin/partner-registrations?status=pending",
      label: "신규 제휴 접수",
      description: "공개 등록 페이지에서 접수된 신청",
      count: queueCounts.registrationPendingCount,
      permission: "brands",
    },
    {
      href: "/admin/partner-requests",
      label: "제휴처 변경 요청",
      description: "파트너사 담당자가 보낸 변경 승인 요청",
      count: queueCounts.changeRequestPendingCount,
      permission: "brands",
    },
    {
      href: "/admin/partners?tab=plans",
      label: "플랜 검토",
      description: "결제 확인 또는 플랜 승인 대기",
      count: queueCounts.planRequestPendingCount,
      permission: "brands",
    },
    {
      href: "/admin/notifications",
      label: "읽지 않은 알림",
      description: "현재 관리자 계정의 운영 수신함",
      count: queueCounts.unreadNotificationCount,
      permission: "notifications",
    },
  ] satisfies QueueItem[]).filter(
    (item) =>
      (includeGlobalTasks || item.href !== "/admin/partners?tab=plans") &&
      canAdmin(permissions, item.permission, "read"),
  );

  const quickActions = ([
    {
      href: "/admin/members",
      label: "회원 찾기",
      description: "회원 상태와 인증 이력을 확인합니다.",
      meta: `${counts.memberCount.toLocaleString("ko-KR")}명`,
      permission: "members",
      icon: UsersIcon,
    },
    {
      href: "/admin/partners",
      label: "제휴처 찾기",
      description: "혜택과 노출 상태를 확인합니다.",
      meta: `${counts.partnerCount.toLocaleString("ko-KR")}개`,
      permission: "brands",
      icon: TagIcon,
    },
    {
      href: "/admin/partner-requests",
      label: "변경 요청 처리",
      description: "현재 값과 요청 값을 비교합니다.",
      meta: `${queueCounts.changeRequestPendingCount.toLocaleString("ko-KR")}건`,
      permission: "brands",
      icon: QueueListIcon,
    },
    {
      href: "/admin/notifications",
      label: "내 알림 확인",
      description: "내 계정의 운영 알림을 확인합니다.",
      meta: `${queueCounts.unreadNotificationCount.toLocaleString("ko-KR")}건`,
      permission: "notifications",
      icon: BellAlertIcon,
    },
  ] satisfies QuickAction[]).filter((item) =>
    canAdmin(permissions, item.permission, "read"),
  );

  const totalPendingCount = queueItems.reduce(
    (total, item) => total + item.count,
    0,
  );
  const totalLogCount =
    counts.productLogCount + counts.auditLogCount + counts.securityLogCount;
  const operationItems = ([
    {
      label: "회원",
      value: `${counts.memberCount.toLocaleString("ko-KR")}명`,
      description: "전체 계정",
      permission: "members",
      globalOnly: true,
    },
    {
      label: "제휴처",
      value: `${counts.partnerCount.toLocaleString("ko-KR")}개`,
      description: includeGlobalTasks
        ? `카테고리 ${counts.categoryCount.toLocaleString("ko-KR")}개`
        : "담당 캠퍼스 범위",
      permission: "brands",
    },
    {
      label: "리뷰",
      value: `${counts.reviewCount.toLocaleString("ko-KR")}건`,
      description: "삭제 제외",
      permission: "reviews",
      globalOnly: true,
    },
    {
      label: "로그",
      value: `${totalLogCount.toLocaleString("ko-KR")}건`,
      description: "제품·감사·보안",
      permission: "logs",
      globalOnly: true,
    },
  ] satisfies OperationItem[]).filter(
    (item) =>
      (!item.globalOnly || includeGlobalTasks) &&
      canAdmin(permissions, item.permission, "read"),
  );
  const canViewPlatformActivity =
    includeGlobalTasks && canAdmin(permissions, "logs", "read");

  return (
    <div className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="관리 홈"
        description="처리가 필요한 항목부터 확인하고 자주 쓰는 운영 화면으로 이동합니다."
        actions={
          <Button href="/" variant="secondary">
            사용자 홈 보기
          </Button>
        }
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
        <Surface level="elevated" padding="lg" className="grid min-w-0 gap-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <AdminSectionHeading
              title="처리 필요"
              description="대기 중인 운영 작업을 오래된 항목부터 확인하세요."
            />
            <Badge variant={totalPendingCount > 0 ? "warning" : "success"}>
              {totalPendingCount > 0
                ? `${totalPendingCount.toLocaleString("ko-KR")}건 대기`
                : "대기 없음"}
            </Badge>
          </div>
          {queueItems.length === 0 ? (
            <EmptyState
              title="확인할 운영 큐가 없습니다."
              description="현재 계정 권한으로 조회 가능한 작업이 없습니다."
            />
          ) : (
            <div className="grid min-w-0 gap-2">
              {queueItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="grid min-w-0 gap-3 rounded-2xl border border-border/80 bg-surface-inset p-4 transition-colors hover:border-strong hover:bg-surface-control sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {item.label}
                    </p>
                    <p className="text-ko-pretty mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                    {item.count.toLocaleString("ko-KR")}건
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Surface>

        <Surface level="default" padding="lg" className="grid min-w-0 gap-4">
          <AdminSectionHeading
            title="빠른 작업"
            description="운영 빈도가 높은 화면입니다."
          />
          <div className="grid min-w-0 gap-2">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-surface-inset p-3 transition-colors hover:border-strong hover:bg-surface-control"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {item.meta}
                  </span>
                </Link>
              );
            })}
          </div>
        </Surface>
      </div>

      <section className="grid min-w-0 gap-4">
        <AdminSectionHeading
          title="운영 현황"
          description="규모와 시스템 상태를 빠르게 확인합니다."
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {operationItems.map((item) => (
            <Surface key={item.label} level="inset" padding="md" className="min-w-0">
              <p className="ui-kicker">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {item.value}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {item.description}
              </p>
            </Surface>
          ))}
        </div>
        <Surface level="inset" padding="md" className="flex min-w-0 flex-wrap items-center gap-3">
          <UserGroupIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 text-sm text-muted-foreground">
            현재 기수 <span className="font-semibold text-foreground">{cycleMeta}</span>
            {includeGlobalTasks ? (
              <>
                {" · "}파트너사 {counts.companyCount.toLocaleString("ko-KR")}개
                {" · "}담당 계정 {counts.accountCount.toLocaleString("ko-KR")}개
              </>
            ) : (
              <> · 배정된 캠퍼스 범위의 제휴처만 집계합니다.</>
            )}
          </p>
        </Surface>
      </section>

      {canViewPlatformActivity ? (
        platformActivityErrorMessage ? (
          <InlineMessage
            tone="warning"
            title="서비스 활성 지표를 불러오지 못했습니다."
            description="기존 로그 집계가 완료되면 이 영역에서 DAU·WAU·MAU를 확인할 수 있습니다."
          />
        ) : platformActivityMetrics ? (
          <AdminPlatformActivityMetricsPanel metrics={platformActivityMetrics} />
        ) : null
      ) : null}
    </div>
  );
}
