import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import type { PartnerSession } from "@/lib/partner-session";
import type { PartnerPortalDashboard } from "@/lib/partner-dashboard";
import { cn } from "@/lib/cn";

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {formatCount(value)}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ServiceMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">
        {formatCount(value)}
      </p>
    </div>
  );
}

function ServiceCard({
  service,
}: {
  service: PartnerPortalDashboard["companies"][number]["services"][number];
}) {
  return (
    <Link
      href={`/partner/services/${encodeURIComponent(service.id)}`}
      aria-label={`${service.name} 상세 보기`}
      className="group block rounded-2xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/30 hover:bg-background/80"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={getPartnerVisibilityBadgeClass(service.visibility)}
            >
              {getPartnerVisibilityLabel(service.visibility)}
            </Badge>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {service.categoryLabel}
            </span>
          </div>
          <p className="text-lg font-semibold text-foreground">{service.name}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {service.location}
          </p>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          상세 보기
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ServiceMetric label="조회수" value={service.metrics.detailViews} />
        <ServiceMetric label="총 클릭" value={service.metrics.totalClicks} />
        <ServiceMetric label="카드 클릭" value={service.metrics.cardClicks} />
        <ServiceMetric label="지도 클릭" value={service.metrics.mapClicks} />
        <ServiceMetric
          label="예약 클릭"
          value={service.metrics.reservationClicks}
        />
        <ServiceMetric label="문의 클릭" value={service.metrics.inquiryClicks} />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
          클릭하여 상세를 확인하고 연필로 수정 요청을 시작하세요.
        </span>
      </div>
    </Link>
  );
}

function CompanySection({
  company,
}: {
  company: PartnerPortalDashboard["companies"][number];
}) {
  return (
    <Card className="space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary">제휴 회사</Badge>
            <Badge className="bg-surface text-muted-foreground">
              서비스 {company.services.length}개
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {company.name}
          </h2>
          {company.description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {company.description}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="조회수"
            value={company.totals.detailViews}
            hint="해당 회사 서비스들의 상세 페이지 조회 합계"
          />
          <MetricCard
            label="총 클릭"
            value={company.totals.totalClicks}
            hint="카드, 지도, 예약, 문의 클릭 합계"
          />
          <MetricCard
            label="서비스 수"
            value={company.services.length}
            hint="포털에서 관리 가능한 연결 서비스"
          />
        </div>
      </div>

      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            담당자
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {company.contactName ?? "미지정"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            연락처
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-foreground">
            {company.contactEmail ?? company.contactPhone ?? "미지정"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            식별자
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-foreground">
            {company.slug}
          </p>
        </div>
      </div>

      {company.services.length === 0 ? (
        <EmptyState
          title="연결된 서비스가 없습니다."
          description="관리자에서 업체 서비스를 연결하면 여기에서 조회할 수 있습니다."
        />
      ) : (
        <div className="space-y-3">
          {company.services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PartnerDashboardView({
  session,
  dashboard,
}: {
  session: PartnerSession;
  dashboard: PartnerPortalDashboard;
}) {
  return (
    <div className="bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
              <Badge className="bg-surface text-muted-foreground">
                집계 수치만 제공
              </Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                회사별 서비스 현황
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {session.displayName}님 계정으로 로그인되었습니다. 이 화면에서는
                회사별 서비스 정보와 조회수, 클릭수 같은 집계 값만 확인할 수
                있습니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="연결 회사"
                value={dashboard.totals.companyCount}
                hint="이 계정이 관리하는 회사 수"
              />
              <MetricCard
                label="서비스 수"
                value={dashboard.totals.serviceCount}
                hint="연결된 회사의 전체 서비스 수"
              />
              <MetricCard
                label="조회수"
                value={dashboard.totals.detailViews}
                hint="전체 서비스 상세 페이지 조회 합계"
              />
              <MetricCard
                label="총 클릭"
                value={dashboard.totals.totalClicks}
                hint="카드, 지도, 예약, 문의 클릭 합계"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>로그인 아이디: {session.loginId}</span>
              <span>연결 회사: {session.companyIds.length}개</span>
              <span>세션 상태: 분리 세션 활성화</span>
            </div>
          </Card>

          {dashboard.companies.length === 0 ? (
            <EmptyState
              title="연결된 회사가 없습니다."
              description="관리자에서 업체와 연결된 회사 정보를 먼저 생성해야 합니다."
            />
          ) : (
            dashboard.companies.map((company) => (
              <CompanySection key={company.id} company={company} />
            ))
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button href="/partner/setup" variant="ghost">
              초기 설정 데모
            </Button>
            <Button href="/" variant="ghost">
              홈으로
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
