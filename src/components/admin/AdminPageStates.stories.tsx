import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ToastProvider } from "@/components/ui/Toast";
import type { AdminNotificationListResult } from "@/lib/admin-notification-inbox";
import { ADMIN_PERMISSION_TEMPLATES } from "@/lib/admin-permissions";
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroupsByPermissions,
  type AdminNavGroup,
} from "./admin-navigation";
import AdminDashboardView, {
  type AdminDashboardViewState,
} from "./AdminDashboardView";
import AdminPageHeader from "./AdminPageHeader";
import AdminNotificationInbox from "./AdminNotificationInbox";
import AdminShellView from "./AdminShellView";

const now = "2026-07-05T09:30:00.000+09:00";

const notificationState: AdminNotificationListResult = {
  unreadCount: 2,
  nextOffset: 2,
  hasMore: true,
  items: [
    {
      id: "mock-admin-notification-security",
      adminNotificationRecipientId: "mock-admin-recipient-security",
      notificationId: "mock-admin-notification-security",
      type: "security_alert",
      title: "관리자 로그인 시도 실패가 반복되었습니다",
      body: "동일 IP에서 여러 계정으로 로그인 실패가 발생했습니다. 보안 로그에서 상세 내역을 확인하세요.",
      targetUrl: "/admin/logs",
      metadata: {},
      readAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      isUnread: true,
    },
    {
      id: "mock-admin-notification-expiring",
      adminNotificationRecipientId: "mock-admin-recipient-expiring",
      notificationId: "mock-admin-notification-expiring",
      type: "expiring_partner",
      title: "카페 싸피 삼성점 제휴 종료가 7일 남았습니다",
      body: "파트너사 담당자에게 갱신 여부를 확인하고, 만료 전 플랜 상태와 노출 상태를 함께 점검하세요.",
      targetUrl: "/admin/partners/mock-partner-service-cafe-ssafy-samseong",
      metadata: {},
      readAt: null,
      deletedAt: null,
      createdAt: "2026-07-05T08:20:00.000+09:00",
      updatedAt: "2026-07-05T08:20:00.000+09:00",
      isUnread: true,
    },
  ],
};

function AdminPageStateFrame({
  title,
  children,
  navGroups = ADMIN_NAV_GROUPS,
}: {
  title: string;
  children: ReactNode;
  navGroups?: AdminNavGroup[];
}) {
  return (
    <AdminShellView
      title={title}
      logoutAction={async () => {}}
      navGroups={navGroups}
    >
      {children}
    </AdminShellView>
  );
}

function DashboardOverviewState({
  state = "ready",
  longKorean = false,
  regional = false,
}: {
  state?: AdminDashboardViewState;
  longKorean?: boolean;
  regional?: boolean;
}) {
  const permissions = ADMIN_PERMISSION_TEMPLATES.find(
    (template) =>
      template.key ===
      (regional ? "regional_partner_manager" : "super_admin"),
  )?.permissions;

  if (!permissions) {
    return null;
  }

  return (
    <AdminPageStateFrame
      title="관리 대시보드"
      navGroups={filterAdminNavGroupsByPermissions(ADMIN_NAV_GROUPS, permissions, {
        includeGlobalItems: !regional,
      })}
    >
      <AdminDashboardView
        counts={{
          memberCount: 428,
          companyCount: 18,
          partnerCount: regional ? 4 : 32,
          categoryCount: 8,
          accountCount: 21,
          reviewCount: 164,
          activePushSubscriptionCount: 283,
          productLogCount: 4821,
          auditLogCount: 918,
          securityLogCount: 73,
        }}
        queueCounts={{
          registrationPendingCount: 3,
          changeRequestPendingCount: 2,
          planRequestPendingCount: 1,
          unreadNotificationCount: 4,
        }}
        permissions={permissions}
        cycleMeta={
          longKorean
            ? "15기 · 서울 캠퍼스 하반기 집중 운영 및 장기 제휴 갱신 검토 기간"
            : "15기 · 2학기"
        }
        state={state}
        includeGlobalTasks={!regional}
        platformActivityMetrics={
          regional
            ? null
            : {
                asOfDate: "2026-07-21",
                memberDau: 48,
                memberWau: 162,
                memberMau: 341,
                guestSessionDau: 67,
                guestSessionWau: 240,
                guestSessionMau: 592,
                historyStartDate: "2026-04-29",
                dailySeries: Array.from({ length: 84 }, (_, index) => {
                  const date = new Date(Date.UTC(2026, 3, 29 + index));
                  return {
                    date: date.toISOString().slice(0, 10),
                    memberActiveCount: 18 + ((index * 11) % 37),
                    guestSessionCount: 26 + ((index * 13) % 58),
                  };
                }),
              }
        }
        errorMessage={
          state === "error"
            ? "운영 집계 서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
            : undefined
        }
      />
    </AdminPageStateFrame>
  );
}

function CompanyBillingState() {
  return (
    <AdminPageStateFrame title="파트너사 관리">
      <div className="grid gap-4">
        <AdminPageHeader
          eyebrow="Companies"
          title="파트너사와 계정"
          description="계약 회사와 담당자 계정을 관리합니다."
        />
        <Card className="grid min-w-0 gap-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-kicker">Plan & Billing</p>
              <h2 className="truncate text-xl font-semibold text-foreground">
                카페 싸피 플랜/과금 검토
              </h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                계좌이체 입금 확인, 세금계산서 발급 상태, 제휴처별 플랜 기간을 한 화면에서 점검합니다.
              </p>
            </div>
            <Badge variant="warning">입금 확인 대기</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              ["Basic", "제휴처 3개", "제휴기간과 동일"],
              ["Partner", "제휴처 2개", "집계 리포트 제공"],
              ["Boost", "제휴처 1개", "홈 배너와 푸시/MM 노출"],
            ].map(([tier, count, description]) => (
              <div key={tier} className="ui-surface-inset min-w-0 rounded-card p-4">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{tier}</p>
                  <Badge variant={tier === "Boost" ? "primary" : "neutral"}>{count}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card tone="elevated" className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">대기</Badge>
            <Badge variant="neutral">세금계산서 발급 요청</Badge>
            <Badge variant="primary">Partner → Boost</Badge>
          </div>
          <h3 className="truncate text-lg font-semibold text-foreground">
            카페 싸피 역삼점
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            입금자명 카페싸피 운영팀, 청구번호 INV-202607-SSAFY-001, 납부기한 2026년 7월 12일.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary">입금 확인 저장</Button>
            <Button>승인하고 플랜 적용</Button>
          </div>
        </Card>
      </div>
    </AdminPageStateFrame>
  );
}

function PartnerEditorState() {
  return (
    <AdminPageStateFrame title="제휴처 편집">
      <div className="grid min-w-0 gap-5">
        <AdminPageHeader
          eyebrow="Partner"
          title="제휴처 상세"
          description="혜택과 공개 상태를 검토합니다."
        />
        <Card className="grid min-w-0 gap-5">
        <div className="min-w-0">
          <p className="ui-kicker">Brand Editor</p>
          <h2 className="truncate text-xl font-semibold text-foreground">
            카페 싸피 강남점 정보 검토
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            공개 상태, 혜택 조건, 이미지, 승인 필요 변경 요청을 저장 전에 같은 위계로 확인합니다.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="ui-surface-inset min-w-0 rounded-card p-4">
            <p className="truncate text-sm font-semibold text-foreground">기본 정보</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">카테고리</dt>
                <dd className="truncate font-medium text-foreground">카페</dd>
              </div>
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">위치</dt>
                <dd className="truncate font-medium text-foreground">
                  서울 강남구 테헤란로 212 인근
                </dd>
              </div>
            </dl>
          </div>
          <div className="ui-surface-inset min-w-0 rounded-card p-4">
            <p className="truncate text-sm font-semibold text-foreground">이미지/검증</p>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
              대표 이미지 1장과 상세 이미지 4장을 WebP로 저장하고, 긴 혜택 문구는 카드에서 2줄로 제한합니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" href="/admin/partners">
            목록으로
          </Button>
          <Button>제휴처 저장</Button>
        </div>
        </Card>
      </div>
    </AdminPageStateFrame>
  );
}

function NotificationsInboxState() {
  return (
    <ToastProvider>
      <AdminPageStateFrame title="관리자 알림">
        <div className="grid gap-6">
          <AdminPageHeader
            eyebrow="Notifications"
            title="내 알림"
            description="현재 관리자 계정으로 수신한 운영 알림입니다."
          />
          <AdminNotificationInbox initialState={notificationState} />
        </div>
      </AdminPageStateFrame>
    </ToastProvider>
  );
}

const meta = {
  title: "Domains/Admin/PageStates",
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const DashboardOverview: Story = {
  render: () => <DashboardOverviewState />,
  parameters: {
    mockScenario: {
      routePath: "/admin",
      scenarioId: "admin.dashboard.default",
    },
  },
};

export const DashboardLongKorean: Story = {
  render: () => <DashboardOverviewState longKorean />,
  parameters: {
    mockScenario: {
      routePath: "/admin",
      scenarioId: "admin.dashboard.default",
    },
  },
};

export const DashboardMobile: Story = {
  render: () => <DashboardOverviewState longKorean />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    mockScenario: {
      routePath: "/admin",
      scenarioId: "admin.dashboard.default",
    },
  },
};

export const DashboardRegionalScope: Story = {
  render: () => <DashboardOverviewState regional />,
  parameters: {
    mockScenario: {
      routePath: "/admin",
      scenarioId: "admin.dashboard.default",
    },
  },
};

export const DashboardLoading: Story = {
  render: () => <DashboardOverviewState state="loading" />,
};

export const DashboardError: Story = {
  render: () => <DashboardOverviewState state="error" />,
};

export const DashboardUnauthorized: Story = {
  render: () => <DashboardOverviewState state="unauthorized" />,
};

export const DashboardForbidden: Story = {
  render: () => <DashboardOverviewState state="forbidden" />,
};

export const CompanyBilling: Story = {
  render: () => <CompanyBillingState />,
  parameters: {
    mockScenario: {
      routePath: "/admin/companies",
      scenarioId: "admin.company.billing",
    },
  },
};

export const NotificationsInbox: Story = {
  render: () => <NotificationsInboxState />,
  parameters: {
    mockScenario: {
      routePath: "/admin/notifications",
      scenarioId: "admin.notifications.inbox",
    },
  },
};

export const PartnerEditor: Story = {
  render: () => <PartnerEditorState />,
  parameters: {
    mockScenario: {
      routePath: "/admin/partners/[partnerId]",
      scenarioId: "admin.partners.editor",
    },
  },
};
