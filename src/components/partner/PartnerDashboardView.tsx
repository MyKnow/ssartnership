"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import MotionReveal from "@/components/ui/MotionReveal";
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
import { isOnlinePartnerLocation } from "@/lib/partner-service-mode";
import { getCompanyScopedPartnerServiceHref } from "@/lib/partner-portal-paths";

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

function ServiceCard({
  companyId,
  service,
}: {
  companyId: string;
  service: PartnerPortalDashboard["companies"][number]["services"][number];
}) {
  const isOnlineService = isOnlinePartnerLocation(service.location);
  const visibleMetrics = [
    { key: "favoriteCount", label: "즐겨찾기", value: service.metrics.favoriteCount },
    { key: "reviewCount", label: "리뷰", value: service.metrics.reviewCount },
    { key: "detailViews", label: "PV", value: service.metrics.detailViews },
    { key: "detailUv", label: "UV", value: service.metrics.detailUv },
    { key: "totalClicks", label: "총 클릭", value: service.metrics.totalClicks },
  ] as const;

  return (
    <Link
      href={getCompanyScopedPartnerServiceHref(companyId, service.id)}
      prefetch={false}
      aria-label={`${service.name} 상세 보기`}
      className="group block rounded-card border border-border/80 bg-surface-elevated p-5 shadow-flat transition-surface-transform duration-200 ease-out hover:-translate-y-1 hover:border-strong hover-shadow-raised"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getPartnerVisibilityBadgeClass(service.visibility)}>
              {getPartnerVisibilityLabel(service.visibility)}
            </Badge>
            <Badge variant={getServiceStatusBadgeVariant(service.status)}>
              {getPartnerPortalServiceStatusLabel(service.status)}
            </Badge>
            <BrandPlanBadge planTier={service.planTier} />
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {service.categoryLabel}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{service.name}</p>
            {!isOnlineService ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {service.location}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-full border border-border bg-surface-control px-3 py-1 text-xs font-medium text-muted-foreground">
          상세 보기
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {visibleMetrics
          .filter((metric) => canAccessPartnerMetric(service.planTier, metric.key))
          .map((metric) => (
            <ServiceMetric
              key={metric.key}
              label={metric.label}
              value={metric.value}
            />
          ))}
      </div>
    </Link>
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
  const visibleMetrics = [
    { key: "favoriteCount", label: "즐겨찾기", value: company.totals.favoriteCount },
    { key: "reviewCount", label: "리뷰 수", value: company.totals.reviewCount },
    { key: "detailViews", label: "PV", value: company.totals.detailViews },
    { key: "detailUv", label: "UV", value: company.totals.detailUv },
    { key: "totalClicks", label: "총 클릭", value: company.totals.totalClicks },
  ] as const;

  return (
    <Card tone="default" padding="md" className="space-y-5 xl:sticky xl:top-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="ui-kicker">선택된 협력사</p>
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

        <Badge className="bg-surface-muted text-foreground">
          {company.services.length}개 브랜드
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
          <h3 className="text-lg font-semibold text-foreground">소유 브랜드</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {company.services.length}개 브랜드
        </p>
      </div>

      {company.services.length === 0 ? (
        <EmptyState
          title="연결된 브랜드가 없습니다."
          description="관리자에서 협력사 브랜드를 연결하면 여기에서 조회할 수 있습니다."
        />
      ) : (
        <div className="space-y-3">
          {company.services.map((service) => (
            <ServiceCard
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
              title="브랜드 현황"
              description={`${selectedCompany.name}의 소유 브랜드와 핵심 지표를 확인합니다.`}
              actions={
                <Badge variant="primary">로그인 아이디 · {session.loginId}</Badge>
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
                    <CompanyHeader company={activeCompany} />
                    <CompanyBrandList company={activeCompany} />
                  </div>
                </MotionReveal>
              ) : null}
            </>
          )}

          {isPartnerPortalMock ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/partner/setup" variant="secondary">
                초기 설정 데모
              </Button>
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
