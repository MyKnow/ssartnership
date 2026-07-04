"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import MotionReveal from "@/components/ui/MotionReveal";
import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import ShellHeader from "@/components/ui/ShellHeader";
import type {
  PartnerPortalCompanyDashboard,
  PartnerPortalDashboard,
} from "@/lib/partner-dashboard";
import {
  canAccessPartnerMetric,
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import type { PartnerPortalCompanyScope } from "@/lib/partner-portal-scope";
import type { PartnerSession } from "@/lib/partner-session";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import {
  getCompanyScopedPartnerServiceHref,
  getCompanyScopedPartnerServiceNewHref,
} from "@/lib/partner-portal-paths";

const partnerPortalDataSource =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE ??
  process.env.NEXT_PUBLIC_DATA_SOURCE ??
  "supabase";
const isPartnerPortalMock = partnerPortalDataSource !== "supabase";

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function ServiceMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1rem] border border-border/80 bg-surface-inset p-4 shadow-none">
      <p className="ui-kicker">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">
        {formatCount(value)}
      </p>
    </div>
  );
}

function BrandPlanBadge({ planTier }: { planTier: PartnerCompanyPlanTier }) {
  const definition = getPartnerCompanyPlanDefinition(planTier);
  return (
    <Badge
      variant={
        planTier === "boost" ? "primary" : planTier === "partner" ? "success" : "neutral"
      }
    >
      {definition.label}
    </Badge>
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

function getPartnerPortalServiceStatusLabel(
  status: PartnerPortalDashboard["companies"][number]["services"][number]["status"],
) {
  switch (status) {
    case "pending":
      return "승인 대기 중";
    case "rejected":
      return "수정 반려됨";
    default:
      return "승인됨";
  }
}

function ServiceListRow({
  companyId,
  service,
}: {
  companyId: string;
  service: PartnerPortalDashboard["companies"][number]["services"][number];
}) {
  const visibleMetrics = [
    { key: "favoriteCount", label: "즐겨찾기", value: service.metrics.favoriteCount },
    { key: "reviewCount", label: "리뷰", value: service.metrics.reviewCount },
    { key: "detailViews", label: "PV", value: service.metrics.detailViews },
    { key: "detailUv", label: "UV", value: service.metrics.detailUv },
    { key: "totalClicks", label: "총 클릭", value: service.metrics.totalClicks },
  ] as const;
  const highlightedMetrics = visibleMetrics
    .filter((metric) => canAccessPartnerMetric(service.planTier, metric.key))
    .slice(0, 3);

  return (
    <PartnerPendingLink
      href={getCompanyScopedPartnerServiceHref(companyId, service.id)}
      prefetch={false}
      aria-label={`${service.name} 상세 보기`}
      className="group grid gap-4 rounded-[1rem] border border-border/80 bg-surface-elevated px-4 py-4 shadow-flat transition-surface hover:border-strong hover:bg-surface-muted/55 lg:grid-cols-[minmax(12rem,1.2fr)_minmax(16rem,1fr)_auto] lg:items-center"
      showSpinner
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getServiceStatusBadgeVariant(service.status)}>
            {getPartnerPortalServiceStatusLabel(service.status)}
          </Badge>
          <BrandPlanBadge planTier={service.planTier} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{service.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {service.categoryLabel} · {service.location || "위치 미지정"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {highlightedMetrics.map((metric) => (
          <div
            key={metric.key}
            className="rounded-[0.85rem] border border-border/60 bg-surface-inset px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {formatCount(metric.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
        <Badge className={getPartnerVisibilityBadgeClass(service.visibility)}>
          {getPartnerVisibilityLabel(service.visibility)}
        </Badge>
        <span className="rounded-full border border-border bg-surface-control px-3 py-1 text-xs font-semibold text-foreground">
          상세
        </span>
      </div>
    </PartnerPendingLink>
  );
}

function canAnyCompanyServiceAccessMetric(
  company: PartnerPortalCompanyDashboard,
  metricKey: Parameters<typeof canAccessPartnerMetric>[1],
) {
  return company.services.some((service) =>
    canAccessPartnerMetric(service.planTier, metricKey),
  );
}

function CompanyHeader({
  company,
}: {
  company: PartnerPortalCompanyDashboard;
}) {
  const needsReview = company.services.some(
    (service) => service.status === "pending" || service.status === "rejected",
  );
  const visibleMetrics = [
    { key: "favoriteCount", label: "즐겨찾기", value: company.totals.favoriteCount },
    { key: "reviewCount", label: "리뷰 수", value: company.totals.reviewCount },
    { key: "detailViews", label: "PV", value: company.totals.detailViews },
    { key: "detailUv", label: "UV", value: company.totals.detailUv },
    { key: "totalClicks", label: "총 클릭", value: company.totals.totalClicks },
  ] as const;

  return (
    <Card tone="default" padding="md" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="ui-kicker">운영 상태</p>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {company.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {company.description?.trim()
                ? company.description
                : "연결된 브랜드와 핵심 지표를 확인할 수 있습니다."}
            </p>
          </div>
        </div>

        <Badge variant={needsReview ? "warning" : "success"}>
          {needsReview ? "검토 진행 중" : "정상 운영"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <ServiceMetric label="브랜드 수" value={company.services.length} />
        {visibleMetrics
          .filter((metric) => canAnyCompanyServiceAccessMetric(company, metric.key))
          .map((metric) => (
            <ServiceMetric
              key={metric.key}
              label={metric.label}
              value={metric.value}
            />
          ))}
      </div>
    </Card>
  );
}

function CompanyBrandList({
  company,
}: {
  company: PartnerPortalCompanyDashboard;
}) {
  return (
    <Card tone="default" padding="md" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <p className="ui-kicker">Brands</p>
          <h3 className="text-lg font-semibold text-foreground">브랜드 운영 현황</h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="text-sm text-muted-foreground">
            {company.services.length}개 브랜드
          </p>
          <PartnerPendingButtonLink
            href={getCompanyScopedPartnerServiceNewHref(company.id)}
            variant="secondary"
            size="sm"
          >
            브랜드 추가
          </PartnerPendingButtonLink>
        </div>
      </div>

      {company.services.length === 0 ? (
        <EmptyState
          title="연결된 브랜드가 없습니다."
          description="관리자에서 협력사 브랜드를 연결하면 여기에서 조회할 수 있습니다."
          action={
            <PartnerPendingButtonLink
              href={getCompanyScopedPartnerServiceNewHref(company.id)}
              variant="primary"
            >
              브랜드 추가 신청
            </PartnerPendingButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {company.services.map((service) => (
            <ServiceListRow
              key={service.id}
              companyId={company.id}
              service={service}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PartnerDashboardView({
  session,
  dashboard,
  selectedCompany,
}: {
  session: PartnerSession;
  dashboard: PartnerPortalDashboard;
  selectedCompany: PartnerPortalCompanyScope;
}) {
  const activeCompany = dashboard.companies[0] ?? null;

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-6 lg:pt-8">
        <div className="space-y-6">
          <MotionReveal>
            <ShellHeader
              eyebrow="Partner Portal"
              title="운영 대시보드"
              description={`${selectedCompany.name}의 브랜드 상태와 핵심 지표를 한 화면에서 확인합니다.`}
              actions={
                <Badge
                  variant="primary"
                  className="max-w-full whitespace-normal break-all text-left leading-snug tracking-normal"
                >
                  로그인 아이디 · {session.loginId}
                </Badge>
              }
            />
          </MotionReveal>

          {dashboard.warningMessage ? (
            <MotionReveal delay={0.03}>
              <FormMessage variant="info">{dashboard.warningMessage}</FormMessage>
            </MotionReveal>
          ) : null}

          {dashboard.companies.length === 0 ? (
            <EmptyState
              title="연결된 협력사가 없습니다."
              description="관리자에서 이 계정과 협력사를 먼저 연결해야 합니다."
            />
          ) : (
            <>
              {activeCompany ? (
                <MotionReveal delay={0.08}>
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
                    <div className="grid gap-5 xl:sticky xl:top-24">
                      <CompanyHeader company={activeCompany} />
                    </div>
                    <CompanyBrandList company={activeCompany} />
                  </div>
                </MotionReveal>
              ) : null}
            </>
          )}

          {isPartnerPortalMock ? (
            <div className="flex flex-wrap items-center gap-3">
              <PartnerPendingButtonLink href="/partner/setup" variant="secondary">
                초기 설정 데모
              </PartnerPendingButtonLink>
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
