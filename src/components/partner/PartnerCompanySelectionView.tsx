import { ArrowRight, Building2 } from "lucide-react";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import PortalBadge from "@/components/portal-v2/PortalBadge";
import PortalPageHeader from "@/components/portal-v2/PortalPageHeader";
import PortalStatePanel from "@/components/portal-v2/PortalStatePanel";
import { PV2_FOCUS_RING_CLASS_NAME } from "@/components/portal-v2/portal-v2-classes";
import { cn } from "@/lib/cn";
import type { PartnerPortalCompanyScope } from "@/lib/partner-auth/portal-scope";
import { getCompanyScopedPortalHref } from "@/lib/partner-auth/portal-paths";
import type { PartnerSession } from "@/lib/partner-session";

export default function PartnerCompanySelectionView({
  session,
  companies,
}: {
  session: PartnerSession;
  companies: PartnerPortalCompanyScope[];
}) {
  const serviceTotal = companies.reduce((sum, company) => sum + company.serviceCount, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-6 md:px-6 md:pt-8">
      <PortalPageHeader
        eyebrow="파트너 포털"
        title="운영할 파트너사 선택"
        description="관리할 파트너사를 선택하면 해당 파트너사가 소유한 제휴처의 대시보드와 운영 메뉴로 이동합니다."
      />

      {companies.length === 0 ? (
        <PortalStatePanel
          kind="empty"
          title="연결된 파트너사가 없습니다."
          description="관리자에서 이 계정과 파트너사를 먼저 연결해야 합니다."
        />
      ) : (
        <>
          <dl className="grid gap-3 rounded-pv2-panel border border-pv2-border bg-pv2-surface p-4 sm:grid-cols-3 md:p-6">
            <div className="min-w-0">
              <dt className="pv2-caption text-pv2-muted">로그인 계정</dt>
              <dd className="mt-1 truncate pv2-label text-pv2-text">{session.loginId}</dd>
            </div>
            <div className="min-w-0">
              <dt className="pv2-caption text-pv2-muted">파트너사</dt>
              <dd className="mt-1 pv2-label text-pv2-text">
                {companies.length.toLocaleString("ko-KR")}개 연결
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="pv2-caption text-pv2-muted">제휴처</dt>
              <dd className="mt-1 pv2-label text-pv2-text">
                {serviceTotal.toLocaleString("ko-KR")}개 관리
              </dd>
            </div>
          </dl>
          <ul className="grid gap-4 md:grid-cols-2 pv2-desktop:grid-cols-3">
            {companies.map((company) => (
              <li key={company.id} className="min-w-0">
                <PartnerPendingLink
                  href={getCompanyScopedPortalHref(company.id)}
                  showSpinner
                  className={cn(
                    "flex h-full min-h-11 flex-col gap-4 rounded-pv2-panel border border-pv2-border bg-pv2-surface p-4 hover:border-pv2-blue md:p-6",
                    PV2_FOCUS_RING_CLASS_NAME,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-10 items-center justify-center rounded-pv2-control bg-pv2-blue-soft text-pv2-blue"
                    >
                      <Building2 className="size-5" />
                    </span>
                    <PortalBadge>{company.serviceCount}개 제휴처</PortalBadge>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate pv2-heading text-pv2-text">{company.name}</h2>
                    <p className="mt-1 line-clamp-2 pv2-body text-pv2-muted">
                      {company.description?.trim() ||
                        "연결된 제휴처 현황과 운영 알림을 확인합니다."}
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-2 pv2-label text-pv2-blue">
                    선택하기
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </PartnerPendingLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
