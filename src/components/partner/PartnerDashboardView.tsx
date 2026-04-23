"use client";

import { useState } from "react";
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
import type { PartnerSession } from "@/lib/partner-session";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import { cn } from "@/lib/cn";

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
  service,
}: {
  service: PartnerPortalDashboard["companies"][number]["services"][number];
}) {
  return (
    <Link
      href={`/partner/services/${encodeURIComponent(service.id)}`}
      prefetch={false}
      aria-label={`${service.name} 상세 보기`}
      className="group block rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated p-5 shadow-[var(--shadow-flat)] transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out hover:-translate-y-1 hover:border-strong hover:shadow-[var(--shadow-raised)]"
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
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {service.categoryLabel}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{service.name}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {service.location}
            </p>
          </div>
        </div>

        <div className="rounded-full border border-border bg-surface-control px-3 py-1 text-xs font-medium text-muted-foreground">
          상세 보기
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ServiceMetric label="즐겨찾기" value={service.metrics.favoriteCount} />
        <ServiceMetric label="리뷰" value={service.metrics.reviewCount} />
        <ServiceMetric label="PV" value={service.metrics.detailViews} />
        <ServiceMetric label="UV" value={service.metrics.detailUv} />
        <ServiceMetric label="총 클릭" value={service.metrics.totalClicks} />
      </div>
    </Link>
  );
}

function CompanyTabs({
  companies,
  activeCompanyId,
  onChange,
}: {
  companies: PartnerPortalCompanyDashboard[];
  activeCompanyId: string;
  onChange: (companyId: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {companies.map((company) => {
        const active = company.id === activeCompanyId;

        return (
          <button
            key={company.id}
            type="button"
            onClick={() => onChange(company.id)}
            className={cn(
              "rounded-[1.1rem] border px-4 py-3 text-left transition-[background-color,border-color,color,box-shadow] duration-200 ease-out",
              active
                ? "border-primary/20 bg-primary-soft text-primary shadow-[var(--shadow-flat)]"
                : "border-border/80 bg-surface-control text-foreground shadow-[var(--shadow-flat)] hover:border-strong hover:bg-surface-elevated",
            )}
          >
            <p className="text-sm font-semibold">{company.name}</p>
            <p
              className={cn(
                "mt-1 text-xs",
                active ? "text-primary/80" : "text-muted-foreground",
              )}
            >
              {company.services.length}개 브랜드
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CompanyHeader({
  company,
  showKicker,
}: {
  company: PartnerPortalCompanyDashboard;
  showKicker: boolean;
}) {
  return (
    <Card tone="default" padding="md" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {showKicker ? <p className="ui-kicker">선택된 협력사</p> : null}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <ServiceMetric label="브랜드 수" value={company.services.length} />
        <ServiceMetric label="즐겨찾기" value={company.totals.favoriteCount} />
        <ServiceMetric label="리뷰 수" value={company.totals.reviewCount} />
        <ServiceMetric label="PV" value={company.totals.detailViews} />
        <ServiceMetric label="UV" value={company.totals.detailUv} />
        <ServiceMetric label="총 클릭" value={company.totals.totalClicks} />
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
  const [activeCompanyId, setActiveCompanyId] = useState(
    dashboard.companies[0]?.id ?? "",
  );

  const activeCompany =
    dashboard.companies.find((company) => company.id === activeCompanyId) ??
    dashboard.companies[0] ??
    null;
  const showCompanyTabs = dashboard.companies.length > 1;

  return (
    <div className="bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <MotionReveal>
            <ShellHeader
              eyebrow="Partner Portal"
              title="브랜드 현황"
              description={
                showCompanyTabs
                  ? "협력사를 선택하면 해당 협력사의 정보와 브랜드 목록을 볼 수 있습니다."
                  : "연결된 브랜드와 핵심 지표를 한 화면에서 확인할 수 있습니다."
              }
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
              {showCompanyTabs ? (
                <MotionReveal delay={0.08}>
                  <Card tone="default" padding="md" className="space-y-4">
                    <div className="space-y-1">
                      <p className="ui-kicker">Companies</p>
                      <p className="text-sm text-muted-foreground">
                        협력사 이름을 눌러 해당 브랜드 현황으로 전환합니다.
                      </p>
                    </div>
                    <CompanyTabs
                      companies={dashboard.companies}
                      activeCompanyId={activeCompany?.id ?? ""}
                      onChange={setActiveCompanyId}
                    />
                  </Card>
                </MotionReveal>
              ) : null}

              {activeCompany ? (
                <MotionReveal delay={showCompanyTabs ? 0.11 : 0.08}>
                  <div className="grid gap-3">
                    <CompanyHeader
                      company={activeCompany}
                      showKicker={showCompanyTabs}
                    />
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
