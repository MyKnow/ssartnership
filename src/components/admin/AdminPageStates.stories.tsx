import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ToastProvider } from "@/components/ui/Toast";
import type { AdminNotificationListResult } from "@/lib/admin-notification-inbox";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
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
      body: "협력사 담당자에게 갱신 여부를 확인하고, 만료 전 플랜 상태와 노출 상태를 함께 점검하세요.",
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
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AdminShellView
      title={title}
      logoutAction={async () => {}}
      navGroups={ADMIN_NAV_GROUPS}
    >
      {children}
    </AdminShellView>
  );
}

function DashboardOverviewState() {
  return (
    <AdminPageStateFrame title="관리 대시보드">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="grid min-w-0 gap-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-kicker">Operations</p>
              <h2 className="truncate text-xl font-semibold text-foreground">
                오늘 운영 확인이 필요한 항목
              </h2>
            </div>
            <Badge variant="warning">검토 6건</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["신규 파트너사", "3건", "접수 후 관리자 검토 대기"],
              ["플랜 결제", "2건", "입금 확인 또는 세금계산서 발급 대기"],
              ["보안 알림", "1건", "관리자 로그인 실패 반복"],
            ].map(([label, value, description]) => (
              <div key={label} className="ui-surface-inset min-w-0 rounded-card p-4">
                <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="grid min-w-0 gap-3" tone="muted">
          <h3 className="truncate text-base font-semibold text-foreground">빠른 이동</h3>
          <Button href="/admin/partner-registrations" variant="secondary">
            신규 신청 검토
          </Button>
          <Button href="/admin/companies" variant="secondary">
            플랜/과금 관리
          </Button>
          <Button href="/admin/notifications" variant="secondary">
            관리자 알림
          </Button>
        </Card>
      </div>
    </AdminPageStateFrame>
  );
}

function CompanyBillingState() {
  return (
    <AdminPageStateFrame title="협력사 관리">
      <div className="grid gap-4">
        <Card className="grid min-w-0 gap-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-kicker">Plan & Billing</p>
              <h2 className="truncate text-xl font-semibold text-foreground">
                카페 싸피 플랜/과금 검토
              </h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                계좌이체 입금 확인, 세금계산서 발급 상태, 브랜드별 플랜 기간을 한 화면에서 점검합니다.
              </p>
            </div>
            <Badge variant="warning">입금 확인 대기</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              ["Basic", "3개 브랜드", "제휴기간과 동일"],
              ["Partner", "2개 브랜드", "집계 리포트 제공"],
              ["Boost", "1개 브랜드", "홈 배너와 푸시/MM 노출"],
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
    <AdminPageStateFrame title="브랜드 편집">
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
          <Button>브랜드 저장</Button>
        </div>
      </Card>
    </AdminPageStateFrame>
  );
}

function NotificationsInboxState() {
  return (
    <ToastProvider>
      <AdminPageStateFrame title="관리자 알림">
        <AdminNotificationInbox initialState={notificationState} />
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
