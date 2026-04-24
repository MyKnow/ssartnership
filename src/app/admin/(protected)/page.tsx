import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSsafyCycleOverview,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";

export const dynamic = "force-dynamic";

type SummaryCardProps = {
  href: string;
  title: string;
  description: string;
  meta: string;
};

function SummaryCard({ href, title, description, meta }: SummaryCardProps) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-surface-transform duration-200 ease-out hover:-translate-y-1 hover:border-strong hover:bg-surface-elevated hover-shadow-raised">
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="grid gap-2">
            <p className="ui-kicker">
              Admin
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">{title}</h2>
            <p className="ui-body">{description}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{meta}</span>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border bg-surface-muted text-foreground transition group-hover:border-strong">
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </div>
        </div>
      </Card>
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
  const [
    cycleSettings,
    memberResult,
    companyResult,
    partnerResult,
    categoryResult,
    accountResult,
    reviewResult,
    pushResult,
    productLogResult,
    auditLogResult,
    securityLogResult,
  ] = await Promise.all([
    getSsafyCycleSettings(),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("partner_companies").select("id", { count: "exact", head: true }),
    supabase.from("partners").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("partner_accounts").select("id", { count: "exact", head: true }),
    supabase
      .from("partner_reviews")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("event_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("admin_audit_logs")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("auth_security_logs")
      .select("id", { count: "exact", head: true }),
  ]);
  const cycleOverview = getSsafyCycleOverview(cycleSettings);

  const memberCount = memberResult.error ? 0 : memberResult.count ?? 0;
  const companyCount = companyResult.error ? 0 : companyResult.count ?? 0;
  const partnerCount = partnerResult.error ? 0 : partnerResult.count ?? 0;
  const categoryCount = categoryResult.error ? 0 : categoryResult.count ?? 0;
  const accountCount = accountResult.error ? 0 : accountResult.count ?? 0;
  const reviewCount = reviewResult.error ? 0 : reviewResult.count ?? 0;
  const pushSubscriptionCount = pushResult.error ? 0 : pushResult.count ?? 0;
  const productLogCount = productLogResult.error ? 0 : productLogResult.count ?? 0;
  const auditLogCount = auditLogResult.error ? 0 : auditLogResult.count ?? 0;
  const securityLogCount = securityLogResult.error ? 0 : securityLogResult.count ?? 0;
  const totalLogCount = productLogCount + auditLogCount + securityLogCount;
  const cycleMeta = cycleSettings.manualCurrentYear
    ? `${cycleOverview.currentYear}기 · 조기 시작`
    : `${cycleOverview.currentYear}기 · ${cycleOverview.currentSemester}학기`;

  return (
    <AdminShell title="Admin 관리 홈">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          href="/admin/members"
          title="회원 관리"
          description="교육생 계정을 조회하고 검색, 정렬, 필터링한 뒤 수정 또는 삭제할 수 있습니다."
          meta={`총 ${memberCount}명 회원`}
        />
        <SummaryCard
          href="/admin/companies"
          title="협력사 관리"
          description="협력사 자체와 담당자 계정, 연결 상태를 관리합니다."
          meta={`협력사 ${companyCount}개 · 계정 ${accountCount}개`}
        />
        <SummaryCard
          href="/admin/partners"
          title="브랜드 관리"
          description="브랜드별 혜택, 조건, 태그, 변경 요청을 관리합니다."
          meta={`브랜드 ${partnerCount}개 · 카테고리 ${categoryCount}개`}
        />
        <SummaryCard
          href="/admin/push"
          title="알림 전송"
          description="운영 공지와 마케팅 메시지를 작성해 발송합니다."
          meta={`활성 구독 ${pushSubscriptionCount}개`}
        />
        <SummaryCard
          href="/admin/notifications"
          title="알림센터"
          description="발송 결과, 실패, 예약/즉시 발송, 대상자 요약을 확인합니다."
          meta="발송 · 실패 · 대상 · 자동"
        />
        <SummaryCard
          href="/admin/advertisement"
          title="홈 광고 관리"
          description="홈 캐러셀 카드의 순서, 이미지, 문구, 연결 페이지를 관리합니다."
          meta="홈 캐러셀 CRUD"
        />
        <SummaryCard
          href="/admin/event"
          title="이벤트 관리"
          description="이벤트 페이지 등록과 진행 전, 진행 중, 진행 후 상태를 관리합니다."
          meta="등록 · 진행 전 · 진행 중 · 진행 후"
        />
        <SummaryCard
          href="/admin/reviews"
          title="리뷰 관리"
          description="회원 리뷰의 공개 상태와 삭제를 관리합니다."
          meta={`총 ${reviewCount.toLocaleString()}건 리뷰`}
        />
        <SummaryCard
          href="/admin/logs"
          title="로그 조회"
          description="집계 뷰와 대시보드, 검색·정렬·필터가 가능한 로그 탐색 화면으로 이동합니다."
          meta={`전체 ${totalLogCount.toLocaleString()}건 로그`}
        />
        <SummaryCard
          href="/admin/cycle"
          title="기수 관리"
          description="현재 기수 계산 기준과 조기 시작 상태를 확인하고 복구할 수 있습니다."
          meta={cycleMeta}
        />
        <SummaryCard
          href="/admin/style-guide"
          title="UI 스타일 가이드"
          description="토큰, 프리미티브, 컴포넌트 조합을 light/dark와 반응형에서 검증합니다."
          meta="디자인 시스템 기준 확인"
        />
      </div>
    </AdminShell>
  );
}
