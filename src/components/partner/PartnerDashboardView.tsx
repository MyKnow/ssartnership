"use client";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import MotionReveal from "@/components/ui/MotionReveal";
import Surface from "@/components/ui/Surface";
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
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import { getPartnerBranchScopeLabel } from "@/lib/partner-branch-registration";
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
    <Surface level="inset" padding="md" className="min-w-0">
      <p className="ui-kicker">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-foreground">
        {formatCount(value)}
      </p>
    </Surface>
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
    { key: "favoriteCount", label: "저장", value: service.metrics.favoriteCount },
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
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {service.categoryLabel} · {service.location || "위치 미지정"}
          </p>
          {service.branchScopeType && service.branchScopeType !== "single_location" ? (
            <p className="line-clamp-1 text-xs font-semibold text-warning">
              {getPartnerBranchScopeLabel(service.branchScopeType)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-3">
        {highlightedMetrics.map((metric) => (
          <div
            key={metric.key}
            className="rounded-[0.85rem] border border-border/60 bg-surface-inset px-3 py-2"
          >
            <p className="line-clamp-1 text-[11px] font-semibold text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
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

function CompanyMetrics({
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
    <Card tone="default" padding="md" className="space-y-5">
      <div className="min-w-0 space-y-1">
        <p className="ui-kicker">Metrics</p>
        <h2 className="truncate text-lg font-semibold text-foreground">
          핵심 지표
        </h2>
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          이용자가 제휴처를 찾고 저장하고 방문한 흐름을 요약합니다.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceMetric label="제휴처 수" value={company.services.length} />
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
    <Card id="services" tone="default" padding="md" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <p className="ui-kicker">Partnerships</p>
          <h2 className="text-lg font-semibold text-foreground">제휴처 운영 현황</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="text-sm text-muted-foreground">
            {company.services.length}개 제휴처
          </p>
          <PartnerPendingButtonLink
            href={getCompanyScopedPartnerServiceNewHref(company.id)}
            variant="secondary"
            size="sm"
          >
            제휴처 추가
          </PartnerPendingButtonLink>
        </div>
      </div>

      {company.services.length === 0 ? (
        <EmptyState
          title="연결된 제휴처가 없습니다."
          description="관리자가 파트너사 제휴처를 연결하면 여기에서 조회할 수 있습니다."
          action={
            <PartnerPendingButtonLink
              href={getCompanyScopedPartnerServiceNewHref(company.id)}
              variant="primary"
            >
              제휴처 추가 신청
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

function CompanyOperationsSummary({
  company,
}: {
  company: PartnerPortalCompanyDashboard;
}) {
  const pendingCount = company.services.filter(
    (service) => service.status === "pending",
  ).length;
  const rejectedCount = company.services.filter(
    (service) => service.status === "rejected",
  ).length;
  const hiddenCount = company.services.filter(
    (service) => service.visibility !== "public",
  ).length;
  const boostCount = company.services.filter(
    (service) => service.planTier === "boost",
  ).length;
  const attentionCount = pendingCount + rejectedCount + hiddenCount;
  const operationItems = [
    {
      label: "검토 필요",
      value: `${attentionCount.toLocaleString("ko-KR")}건`,
      description:
        attentionCount > 0
            ? "승인 대기, 반려, 검토용 공개 상태를 확인하세요."
          : "승인/공개 상태가 안정적으로 유지되고 있습니다.",
      tone: attentionCount > 0 ? "warning" : "success",
    },
    {
      label: "공개 제휴처",
      value: `${(company.services.length - hiddenCount).toLocaleString("ko-KR")}개`,
      description: "사용자 화면에서 노출 중인 제휴처 수입니다.",
      tone: "neutral",
    },
    {
      label: "Boost 운영",
      value: `${boostCount.toLocaleString("ko-KR")}개`,
      description: "상세 지표와 광고 성과 제공",
      tone: boostCount > 0 ? "primary" : "neutral",
    },
  ] as const;

  return (
    <Card tone="elevated" padding="md" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="ui-kicker">운영 요약</p>
          <h2 className="truncate text-lg font-semibold text-foreground">
            먼저 확인할 상태
          </h2>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            제휴처 운영 상태, 노출 상태, 플랜 구성을 빠르게 점검합니다.
          </p>
        </div>
        <Badge variant={attentionCount > 0 ? "warning" : "success"}>
          {attentionCount > 0 ? "확인 필요" : "정상 운영"}
        </Badge>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {operationItems.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {item.label}
              </p>
              <Badge variant={item.tone}>{item.value}</Badge>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PartnerDashboardView({
  dashboard,
}: {
  dashboard: PartnerPortalDashboard;
}) {
  const activeCompany = dashboard.companies[0] ?? null;

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-6 lg:pt-8">
        <div className="space-y-6">
          <MotionReveal>
            <ShellHeader
              eyebrow="Partner Portal"
              title="운영 홈"
              description="처리할 항목을 먼저 확인하고 제휴처 운영 현황과 핵심 지표를 이어서 살펴봅니다."
            />
          </MotionReveal>

          {dashboard.warningMessage ? (
            <MotionReveal delay={0.03}>
              <FormMessage variant="info">{dashboard.warningMessage}</FormMessage>
            </MotionReveal>
          ) : null}

          {dashboard.companies.length === 0 ? (
            <EmptyState
              title="연결된 파트너사가 없습니다."
              description="관리자에서 이 계정과 파트너사를 먼저 연결해야 합니다."
            />
          ) : (
            <>
              {activeCompany ? (
                <div className="grid min-w-0 gap-5">
                  <MotionReveal delay={0.05}>
                    <CompanyOperationsSummary company={activeCompany} />
                  </MotionReveal>
                  <MotionReveal delay={0.08}>
                    <CompanyBrandList company={activeCompany} />
                  </MotionReveal>
                  <MotionReveal delay={0.11}>
                    <CompanyMetrics company={activeCompany} />
                  </MotionReveal>
                </div>
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
