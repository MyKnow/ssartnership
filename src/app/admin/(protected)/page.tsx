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
      <Card className="h-full transition hover:-translate-y-0.5 hover:border-strong hover:shadow-md">
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Admin
            </p>
            <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{meta}</span>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-muted text-foreground transition group-hover:border-strong">
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
  const cycleSettings = await getSsafyCycleSettings();
  const cycleOverview = getSsafyCycleOverview(cycleSettings);

  const [
    memberResult,
    companyResult,
    partnerResult,
    categoryResult,
    accountResult,
    pushResult,
    productLogResult,
    auditLogResult,
    securityLogResult,
  ] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("partner_companies").select("id", { count: "exact", head: true }),
    supabase.from("partners").select("*", { count: "exact", head: true }),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("partner_accounts").select("id", { count: "exact", head: true }),
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

  const memberCount = memberResult.error ? 0 : memberResult.count ?? 0;
  const companyCount = companyResult.error ? 0 : companyResult.count ?? 0;
  const partnerCount = partnerResult.error ? 0 : partnerResult.count ?? 0;
  const categoryCount = categoryResult.error ? 0 : categoryResult.count ?? 0;
  const accountCount = accountResult.error ? 0 : accountResult.count ?? 0;
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
          title="푸시 알림 관리"
          description="전체 공지 발송과 자동 Web Push 알림 상태를 관리합니다."
          meta={`활성 구독 ${pushSubscriptionCount}개`}
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
      </div>
    </AdminShell>
  );
}
