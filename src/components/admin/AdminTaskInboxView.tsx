import { Suspense } from "react";
import Link from "next/link";
import { ArrowRightIcon, QueueListIcon } from "@heroicons/react/24/outline";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import {
  ADMIN_NAV_ICON_BY_KEY,
  type AdminNavItem,
} from "@/components/admin/admin-navigation";
import {
  getAdminTaskQueueCount,
  prioritizeAdminTaskItems,
  type AdminTaskQueueCounts,
} from "@/lib/admin-task-inbox";
import { getAdminRouteDescriptor } from "@/lib/admin-performance";

function QueueStatus({
  queueCount,
}: {
  queueCount: number | null | undefined;
}) {
  if (queueCount === null) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        상태 확인 필요
      </span>
    );
  }
  if (typeof queueCount === "number") {
    return (
      <Badge variant={queueCount > 0 ? "warning" : "success"}>
        {queueCount > 0
          ? `${queueCount.toLocaleString("ko-KR")}건 대기`
          : "대기 없음"}
      </Badge>
    );
  }
  return null;
}

function AdminTaskInboxTaskList({
  tasks,
  queueCounts,
  loading = false,
}: {
  tasks: AdminNavItem[];
  queueCounts: AdminTaskQueueCounts;
  loading?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <Surface level="elevated" padding="lg">
        <AdminStatePanel
          kind="empty"
          title="현재 계정에서 처리할 작업이 없습니다."
          description="권한이 필요한 운영 업무는 최고 관리자에게 요청해 주세요."
          action={
            <Link
              href="/admin"
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface-control px-4 text-sm font-semibold text-foreground shadow-flat transition-colors hover:border-strong hover:bg-surface-elevated"
            >
              관리 홈으로 이동
            </Link>
          }
        />
      </Surface>
    );
  }

  return (
    <section
      className="grid min-w-0 gap-4"
      aria-label="처리할 업무"
      aria-busy={loading}
    >
      <AdminSectionHeading
        title="처리할 업무"
        description="승인·검토 업무부터 열어 현재 상태와 필요한 다음 행동을 확인하세요."
      />
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        {tasks.map((task) => {
          const Icon = ADMIN_NAV_ICON_BY_KEY[task.iconKey];

          return (
            <Link
              key={task.href}
              href={task.href}
              prefetch={false}
              data-admin-task-key={getAdminRouteDescriptor(task.href)?.key}
              data-admin-task-source="task_inbox"
              className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-card border border-border/80 bg-surface-elevated p-4 shadow-flat transition-colors hover:border-strong hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="grid min-w-0 gap-1">
                <span className="font-semibold text-foreground">
                  {task.label}
                </span>
                <span className="text-ko-pretty text-sm text-muted-foreground">
                  {task.description}
                </span>
              </span>
              <span className="grid shrink-0 justify-items-end gap-2">
                <QueueStatus queueCount={getAdminTaskQueueCount(queueCounts, task.href)} />
                <ArrowRightIcon className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function AdminTaskInboxHeader() {
  return (
    <AdminPageHeader
      eyebrow="작업함"
      title="작업함"
      description="처리할 운영 업무를 열고, 해당 화면에서 근거를 확인한 뒤 한 건씩 안전하게 처리합니다."
    />
  );
}

function AdminTaskInboxFooter() {
  return (
    <Surface
      level="inset"
      padding="md"
      className="flex min-w-0 items-start gap-3"
    >
      <QueueListIcon
        className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-ko-pretty text-sm text-muted-foreground">
        개별 작업 화면에서 처리 대상, 변경 영향, 보완 방법을 확인할 수 있습니다.
        이미 처리됐거나 권한이 바뀐 항목은 안전한 안내와 복귀 경로를 제공합니다.
      </p>
    </Surface>
  );
}

export default function AdminTaskInboxView({
  tasks,
  queueCounts = {},
}: {
  tasks: AdminNavItem[];
  queueCounts?: AdminTaskQueueCounts;
}) {
  return (
    <div className="grid min-w-0 gap-6">
      <AdminTaskInboxHeader />
      <AdminTaskInboxTaskList tasks={tasks} queueCounts={queueCounts} />
      <AdminTaskInboxFooter />
    </div>
  );
}

async function AdminTaskInboxResolvedList({
  tasks,
  queueCounts,
}: {
  tasks: AdminNavItem[];
  queueCounts: Promise<AdminTaskQueueCounts>;
}) {
  let resolvedCounts: AdminTaskQueueCounts;
  try {
    resolvedCounts = await queueCounts;
  } catch {
    resolvedCounts = Object.fromEntries(tasks.map((task) => [task.href, null]));
  }

  return (
    <AdminTaskInboxTaskList
      tasks={prioritizeAdminTaskItems(tasks, resolvedCounts)}
      queueCounts={resolvedCounts}
    />
  );
}

export function AdminTaskInboxLoading({ tasks }: { tasks: AdminNavItem[] }) {
  return <AdminTaskInboxTaskList tasks={tasks} queueCounts={{}} loading />;
}

export function AdminTaskInboxStreamingView({
  tasks,
  queueCounts,
}: {
  tasks: AdminNavItem[];
  queueCounts: Promise<AdminTaskQueueCounts> | null;
}) {
  return (
    <div className="grid min-w-0 gap-6">
      <AdminTaskInboxHeader />
      {queueCounts ? (
        <Suspense fallback={<AdminTaskInboxLoading tasks={tasks} />}>
          <AdminTaskInboxResolvedList tasks={tasks} queueCounts={queueCounts} />
        </Suspense>
      ) : (
        <AdminTaskInboxTaskList tasks={tasks} queueCounts={{}} />
      )}
      <AdminTaskInboxFooter />
    </div>
  );
}
