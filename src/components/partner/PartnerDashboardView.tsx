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
import { isPartnerPortalMock } from "@/lib/partner-portal";
import type { PartnerSession } from "@/lib/partner-session";
import {
  getPartnerPortalCompanyStatusLabel,
  type PartnerPortalDashboard,
} from "@/lib/partner-dashboard";
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

function getCompanyStatusTextClass(
  status: PartnerPortalDashboard["companies"][number]["status"],
) {
  switch (status) {
    case "pending":
      return "text-amber-600 dark:text-amber-400";
    case "rejected":
      return "text-danger";
    default:
      return "text-emerald-600 dark:text-emerald-400";
  }
}

function ServiceCard({
  service,
}: {
  service: PartnerPortalDashboard["companies"][number]["services"][number];
}) {
  return (
    <Link
      href={`/partner/services/${encodeURIComponent(service.id)}`}
      prefetch={false}
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
            hint="해당 협력사 브랜드들의 상세 페이지 조회 합계"
          />
          <MetricCard
            label="총 클릭"
            value={company.totals.totalClicks}
            hint="카드, 지도, 예약, 문의 클릭 합계"
          />
          <MetricCard
            label="브랜드 수"
            value={company.services.length}
            hint="포털에서 관리 가능한 연결 브랜드"
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
            상태
          </p>
          <p
            className={cn(
              "mt-2 text-center text-sm font-semibold",
              getCompanyStatusTextClass(company.status),
            )}
          >
            {getPartnerPortalCompanyStatusLabel(company.status)}
          </p>
        </div>
      </div>

      {company.services.length === 0 ? (
        <EmptyState
          title="연결된 브랜드가 없습니다."
          description="관리자에서 협력사 브랜드를 연결하면 여기에서 조회할 수 있습니다."
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
              <Badge className="bg-primary/10 text-primary">협력사 포털</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                협력사별 브랜드 현황
              </h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="연결 협력사"
                value={dashboard.totals.companyCount}
                hint="이 계정이 관리하는 협력사 수"
              />
              <MetricCard
                label="브랜드 수"
                value={dashboard.totals.serviceCount}
                hint="연결된 협력사의 전체 브랜드 수"
              />
              <MetricCard
                label="조회수"
                value={dashboard.totals.detailViews}
                hint="전체 브랜드 상세 페이지 조회 합계"
              />
              <MetricCard
                label="총 클릭"
                value={dashboard.totals.totalClicks}
                hint="카드, 지도, 예약, 문의 클릭 합계"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>로그인 아이디: {session.loginId}</span>
            </div>
          </Card>

          {dashboard.companies.length === 0 ? (
            <EmptyState
              title="연결된 협력사가 없습니다."
              description="관리자에서 이 협력사에 연결된 브랜드 정보를 먼저 생성해야 합니다."
            />
          ) : (
            dashboard.companies.map((company) => (
              <CompanySection key={company.id} company={company} />
            ))
          )}

          <div className="flex flex-wrap items-center gap-3">
            {isPartnerPortalMock ? (
              <Button href="/partner/setup" variant="ghost">
                초기 설정 데모
              </Button>
            ) : null}
          </div>
        </div>
      </Container>
    </div>
  );
}
