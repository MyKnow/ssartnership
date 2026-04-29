import Link from "next/link";
import {
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ClockIcon,
  MegaphoneIcon,
  QueueListIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import DataPanel from "@/components/ui/DataPanel";
import EmptyState from "@/components/ui/EmptyState";
import ResponsiveGrid from "@/components/ui/ResponsiveGrid";
import ShellHeader from "@/components/ui/ShellHeader";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSsafyCycleOverview,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { fetchAdminDashboardCounts } from "@/lib/partner-counts";

export const dynamic = "force-dynamic";

type LaunchpadItem = {
  href: string;
  title: string;
  description: string;
  meta: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

function OverviewMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <DataPanel
      label={label}
      title={<span className="text-3xl font-semibold tracking-[-0.04em]">{value}</span>}
      description={description}
      className="h-full"
    />
  );
}

function LaunchpadCard({ item }: { item: LaunchpadItem }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} className="group block h-full">
      <div className="flex h-full flex-col gap-4 rounded-panel border border-border/70 bg-surface px-5 py-5 transition hover:border-strong hover:bg-surface-elevated">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface-muted text-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {item.meta}
          </span>
        </div>
        <div className="grid gap-1.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{item.title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </Link>
  );
}

export default async function AdminPage() {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseEnv) {
    return (
      <AdminShell title="Admin 관리 홈">
        <Card className="w-full max-w-xl text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Supabase 설정이 필요합니다.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 설정한 뒤 다시 접속해
            주세요.
          </p>
        </Card>
      </AdminShell>
    );
  }

  const supabase = getSupabaseAdminClient();
  const [cycleSettings, dashboardCountResult] = await Promise.all([
    getSsafyCycleSettings(),
    fetchAdminDashboardCounts(supabase),
  ]);
  const cycleOverview = getSsafyCycleOverview(cycleSettings);

  const dashboardCounts = dashboardCountResult.errorMessage
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

  const totalLogCount =
    dashboardCounts.productLogCount +
    dashboardCounts.auditLogCount +
    dashboardCounts.securityLogCount;

  const launchpadGroups: Array<{
    title: string;
    description: string;
    items: LaunchpadItem[];
  }> = [
    {
      title: "핵심 운영",
      description: "가장 자주 여는 운영 화면입니다.",
      items: [
        {
          href: "/admin/members",
          title: "회원 관리",
          description: "회원 검색, 필터, 계정 상태 수정, 수동 추가와 백필 작업을 진행합니다.",
          meta: `${dashboardCounts.memberCount.toLocaleString()}명`,
          icon: UsersIcon,
        },
        {
          href: "/admin/partners",
          title: "브랜드 관리",
          description: "브랜드 노출 상태, 카테고리, 변경 요청, 상세 수정 흐름을 관리합니다.",
          meta: `${dashboardCounts.partnerCount.toLocaleString()}개`,
          icon: TagIcon,
        },
        {
          href: "/admin/reviews",
          title: "리뷰 관리",
          description: "리뷰 공개 여부, 삭제, 이미지 포함 리뷰 검수 작업을 처리합니다.",
          meta: `${dashboardCounts.reviewCount.toLocaleString()}건`,
          icon: StarIcon,
        },
        {
          href: "/admin/logs",
          title: "로그 조회",
          description: "제품 이벤트, 관리자 감사, 보안 로그를 같은 기준으로 탐색합니다.",
          meta: `${totalLogCount.toLocaleString()}건`,
          icon: QueueListIcon,
        },
      ],
    },
    {
      title: "운영 지원",
      description: "계정, 메시지, 노출 운영과 보조 도구입니다.",
      items: [
        {
          href: "/admin/companies",
          title: "협력사 관리",
          description: "협력사와 담당자 계정, 브랜드 연결 상태를 점검합니다.",
          meta: `회사 ${dashboardCounts.companyCount.toLocaleString()}개`,
          icon: BuildingOffice2Icon,
        },
        {
          href: "/admin/push",
          title: "알림 운영",
          description: "발송 결과 확인과 공지/마케팅 전송을 같은 워크스페이스에서 처리합니다.",
          meta: `구독 ${dashboardCounts.activePushSubscriptionCount.toLocaleString()}개`,
          icon: MegaphoneIcon,
        },
        {
          href: "/admin/advertisement",
          title: "홈 광고 관리",
          description: "사용자 홈 캐러셀 카드와 연결 경로를 관리합니다.",
          meta: "홈 노출 관리",
          icon: ChartBarSquareIcon,
        },
        {
          href: "/admin/event",
          title: "이벤트 관리",
          description: "이벤트 페이지 등록과 진행 상태를 운영합니다.",
          meta: "진행 흐름 관리",
          icon: ClockIcon,
        },
      ],
    },
  ];

  const cycleMeta = cycleSettings.manualCurrentYear
    ? `${cycleOverview.currentYear}기 · 조기 시작`
    : `${cycleOverview.currentYear}기 · ${cycleOverview.currentSemester}학기`;

  return (
    <AdminShell title="Admin 관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Overview"
          title="운영 대시보드"
          description="회원, 제휴, 리뷰, 로그 운영 현황을 한 화면에서 확인하고 자주 쓰는 관리 화면으로 바로 이동합니다."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-foreground"
              >
                사용자 홈 보기
              </Link>
            </div>
          }
        />

        <ResponsiveGrid minItemWidth="15rem">
          <OverviewMetric
            label="회원"
            value={`${dashboardCounts.memberCount.toLocaleString()}명`}
            description="전체 회원 수와 계정 운영 기준입니다."
          />
          <OverviewMetric
            label="브랜드"
            value={`${dashboardCounts.partnerCount.toLocaleString()}개`}
            description={`카테고리 ${dashboardCounts.categoryCount.toLocaleString()}개 기준`}
          />
          <OverviewMetric
            label="리뷰"
            value={`${dashboardCounts.reviewCount.toLocaleString()}건`}
            description="삭제 제외 리뷰 기준입니다."
          />
          <OverviewMetric
            label="로그"
            value={`${totalLogCount.toLocaleString()}건`}
            description="제품·감사·보안 로그 합계입니다."
          />
        </ResponsiveGrid>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <Card tone="elevated" padding="md" className="grid gap-4">
            <div className="grid gap-1">
              <p className="ui-kicker">빠른 작업</p>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">운영자가 자주 여는 화면</h2>
              <p className="text-sm text-muted-foreground">
                운영 빈도가 높은 다섯 개 영역을 우선 배치했습니다.
              </p>
            </div>
            <ResponsiveGrid minItemWidth="13rem">
              {launchpadGroups[0]!.items.map((item) => (
                <LaunchpadCard key={item.href} item={item} />
              ))}
            </ResponsiveGrid>
          </Card>

          <Card tone="elevated" padding="md" className="grid gap-4">
            <div className="grid gap-1">
              <p className="ui-kicker">운영 상태</p>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">현재 기준 요약</h2>
            </div>
            <div className="grid gap-3">
              <DataPanel
                label="협력사/계정"
                title={`${dashboardCounts.companyCount.toLocaleString()}개 · ${dashboardCounts.accountCount.toLocaleString()}개`}
                description="협력사와 담당자 계정 규모입니다."
              />
              <DataPanel
                label="알림 수신"
                title={`${dashboardCounts.activePushSubscriptionCount.toLocaleString()}개`}
                description="활성 푸시 구독 수입니다."
              />
              <DataPanel
                label="현재 기수"
                title={cycleMeta}
                description="관리 홈 기준 기수 계산 상태입니다."
              />
            </div>
          </Card>
        </div>

        {launchpadGroups[1]!.items.length === 0 ? (
          <EmptyState
            title="운영 바로가기가 없습니다."
            description="연결 가능한 운영 화면을 준비 중입니다."
          />
        ) : (
          <Card tone="elevated" padding="md" className="grid gap-4">
            <div className="grid gap-1">
              <p className="ui-kicker">보조 운영</p>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">지원 도구와 설정</h2>
              <p className="text-sm text-muted-foreground">
                메시지, 이벤트, 광고, 스타일 가이드 같은 보조 운영 화면입니다.
              </p>
            </div>
            <ResponsiveGrid minItemWidth="15rem">
              {launchpadGroups[1]!.items.map((item) => (
                <LaunchpadCard key={item.href} item={item} />
              ))}
            </ResponsiveGrid>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
