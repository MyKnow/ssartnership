import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import MotionReveal from "@/components/ui/MotionReveal";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import Link from "next/link";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import type { PartnerSession } from "@/lib/partner-session";
import {
  getPartnerPortalServiceStatusLabel,
  type PartnerPortalDashboard,
} from "@/lib/partner-dashboard";
import { cn } from "@/lib/cn";

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
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
        "rounded-[1.2rem] border border-border/80 bg-surface/90 p-4 shadow-[var(--shadow-flat)]",
        className,
      )}
    >
      <p className="ui-kicker">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">
        {formatCount(value)}
      </p>
    </div>
  );
}

function getServiceStatusBadgeVariant(
  status: PartnerPortalDashboard["companies"][number]["services"][number]["status"],
) {
  switch (status) {
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "success";
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
      className="group block rounded-[var(--radius-card)] border border-border/80 bg-surface-overlay p-4 shadow-[var(--shadow-flat)] transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out hover:-translate-y-1 hover:border-strong hover:bg-surface-elevated hover:shadow-[var(--shadow-raised)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={getPartnerVisibilityBadgeClass(service.visibility)}
            >
              {getPartnerVisibilityLabel(service.visibility)}
            </Badge>
            <Badge variant={getServiceStatusBadgeVariant(service.status)}>
              {getPartnerPortalServiceStatusLabel(service.status)}
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceMetric label="조회수" value={service.metrics.detailViews} />
        <ServiceMetric label="총 클릭" value={service.metrics.totalClicks} />
        <ServiceMetric label="리뷰" value={service.metrics.reviewCount} />
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
    <Card tone="elevated" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {company.name}
          </h2>
          {company.description ? (
            <p className="max-w-3xl ui-body">
              {company.description}
            </p>
          ) : null}
        </div>

        <div className="w-full lg:max-w-3xl">
          <StatsRow
            minItemWidth="11rem"
            items={[
              {
                label: "조회수",
                value: formatCount(company.totals.detailViews),
                hint: "상세 페이지 조회 합계",
              },
              {
                label: "총 클릭",
                value: formatCount(company.totals.totalClicks),
                hint: "카드, 지도, 예약, 문의 클릭 합계",
              },
              {
                label: "브랜드 수",
                value: formatCount(company.services.length),
                hint: "포털에서 관리 가능한 연결 브랜드",
              },
              {
                label: "리뷰 수",
                value: formatCount(company.totals.reviewCount),
                hint: "연결된 브랜드의 전체 리뷰 합계",
              },
            ]}
          />
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
          <MotionReveal>
            <Card tone="elevated" className="space-y-6">
              <ShellHeader
                eyebrow="Partner Portal"
                title="협력사별 브랜드 현황"
                description="협력사 단위로 연결된 브랜드와 조회·클릭 지표를 한 번에 확인합니다."
                actions={<Badge variant="primary">로그인 아이디 · {session.loginId}</Badge>}
              />

              {dashboard.warningMessage ? (
                <FormMessage variant="info">{dashboard.warningMessage}</FormMessage>
              ) : null}

              <StatsRow
                items={[
                  {
                    label: "연결 협력사",
                    value: formatCount(dashboard.totals.companyCount),
                    hint: "이 계정이 관리하는 협력사 수",
                  },
                  {
                    label: "브랜드 수",
                    value: formatCount(dashboard.totals.serviceCount),
                    hint: "연결된 협력사의 전체 브랜드 수",
                  },
                  {
                    label: "리뷰 수",
                    value: formatCount(dashboard.totals.reviewCount),
                    hint: "연결된 브랜드의 전체 리뷰 합계",
                  },
                  {
                    label: "조회수",
                    value: formatCount(dashboard.totals.detailViews),
                    hint: "전체 브랜드 상세 페이지 조회 합계",
                  },
                  {
                    label: "총 클릭",
                    value: formatCount(dashboard.totals.totalClicks),
                    hint: "카드, 지도, 예약, 문의 클릭 합계",
                  },
                ]}
              />
            </Card>
          </MotionReveal>

          {dashboard.companies.length === 0 ? (
            <EmptyState
              title="연결된 협력사가 없습니다."
              description="관리자에서 이 협력사에 연결된 브랜드 정보를 먼저 생성해야 합니다."
            />
          ) : (
            dashboard.companies.map((company, index) => (
              <MotionReveal key={company.id} delay={0.04 + index * 0.03}>
                <CompanySection company={company} />
              </MotionReveal>
            ))
          )}

          <div className="flex flex-wrap items-center gap-3">
            {isPartnerPortalMock ? (
              <Button href="/partner/setup" variant="secondary">
                초기 설정 데모
              </Button>
            ) : null}
          </div>
        </div>
      </Container>
    </div>
  );
}
