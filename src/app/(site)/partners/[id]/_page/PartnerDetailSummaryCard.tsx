import type { CSSProperties, ReactNode } from "react";
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  MapPinIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import TrackedAnchor from "@/components/analytics/TrackedAnchor";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import PageSection from "@/components/ui/PageSection";
import Surface from "@/components/ui/Surface";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import PartnerValueBadge from "@/components/PartnerValueBadge";
import PartnerFavoriteCountLabel from "@/components/partner-favorites/PartnerFavoriteCountLabel";
import PartnerFavoriteButton from "@/components/partner-favorites/PartnerFavoriteButton";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import {
  getPartnerPlaceLinkLabel,
  getPartnerServiceMode,
} from "@/lib/partner-service-mode";
import { getPartnerBranchScopeLabel } from "@/lib/partner-branch-registration";
import type { Partner } from "@/lib/types";
import PartnerDetailInfoRow from "./PartnerDetailInfoRow";

export default function PartnerDetailSummaryCard({
  partner,
  categoryLabel,
  badgeStyle,
  chipStyle,
  mapLink,
  currentUserId,
  isFavorited,
  metrics,
  detailPanel,
  primaryActionPanel,
}: {
  partner: Partner;
  categoryLabel: string;
  badgeStyle?: CSSProperties;
  chipStyle?: CSSProperties;
  mapLink?: string;
  currentUserId?: string | null;
  isFavorited?: boolean;
  metrics?: PartnerPortalServiceMetrics | null;
  detailPanel?: ReactNode;
  primaryActionPanel?: ReactNode;
}) {
  const serviceMode = getPartnerServiceMode(partner.location);
  const isOnlineService = serviceMode === "online";
  const placeLinkLabel = getPartnerPlaceLinkLabel(serviceMode);
  const branchScopeLabel = getPartnerBranchScopeLabel(
    partner.branchScopeType,
    serviceMode,
  );
  const showBranchScope =
    !isOnlineService && partner.branchScopeType && partner.branchScopeType !== "single_location";
  const hasAdditionalInformation = Boolean(
    partner.conditions.length > 0 ||
      partner.detailDescription ||
      partner.branchScopeNote ||
      (partner.tags?.length ?? 0) > 0,
  );
  const additionalInformationSummary = [
    partner.conditions.length > 0
      ? `조건 ${partner.conditions.length}`
      : null,
    (partner.tags?.length ?? 0) > 0 ? `태그 ${partner.tags?.length ?? 0}` : null,
    showBranchScope || partner.branchScopeNote ? "적용 지점" : null,
    partner.detailDescription ? "제휴처 소개" : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ");

  return (
    <Surface
      level="elevated"
      padding="lg"
      className="order-2 min-w-0 overflow-hidden xl:order-1"
      data-partner-detail-summary
    >
      <div
        data-partner-detail-summary-content
        className="flex min-w-0 flex-col gap-7"
      >
        <div className="flex min-w-0 flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              className={
                badgeStyle
                  ? "min-h-8 px-2.5 py-1 text-[11px] font-medium tracking-[0.04em]"
                  : "min-h-8 bg-surface-muted px-2.5 py-1 text-[11px] font-medium tracking-[0.04em] text-foreground"
              }
              style={badgeStyle}
            >
              {categoryLabel}
            </Badge>
            {currentUserId ? (
              <PartnerFavoriteButton
                partnerId={partner.id}
                initialFavorited={Boolean(isFavorited)}
                favoriteCount={metrics?.favoriteCount}
                compact={false}
              />
            ) : (
              <PartnerFavoriteCountLabel favoriteCount={metrics?.favoriteCount} />
            )}
          </div>
          <div
            aria-label={`이용 기간 ${partner.period.start}부터 ${partner.period.end}까지`}
            className="inline-flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-full border border-border/80 bg-surface-inset px-3.5 py-2 text-muted-foreground sm:w-fit"
          >
            <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden text-xs font-medium sm:inline">이용 기간</span>
            <span className="text-token whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
              {partner.period.start} – {partner.period.end}
            </span>
          </div>
        </div>

        <PageSection title="받을 수 있는 혜택">
          {partner.benefits.length > 0 ? (
            <ol
              aria-label="제휴 혜택"
              className="grid gap-px overflow-hidden rounded-[1.4rem] border border-border/80 bg-border/80 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
            >
              {partner.benefits.map((benefit, index) => (
                <li
                  key={`${benefit}-${index}`}
                  className="flex min-w-0 items-start gap-3 bg-surface-inset p-4 sm:p-5"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary-soft text-[11px] font-bold tabular-nums text-primary"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ko-pretty min-w-0 pt-1 text-sm font-semibold leading-6 text-foreground sm:text-base">
                    {benefit}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Surface level="inset" padding="md">
              <p className="ui-body">등록된 혜택 정보가 없습니다.</p>
            </Surface>
          )}
        </PageSection>

        <section
          aria-labelledby={`partner-detail-information-${partner.id}`}
          className="grid min-w-0 gap-5"
        >
          <h2
            id={`partner-detail-information-${partner.id}`}
            className="ui-section-title text-ko-title text-balance"
          >
            세부 정보
          </h2>

          <div
            role="group"
            aria-label="이용 정보"
            data-usage-information-layout
            className="grid grid-cols-1 gap-3"
          >
            {detailPanel}
            <PartnerDetailInfoRow
              label={isOnlineService ? "이용 방식" : "이용 위치"}
              icon={<MapPinIcon className="size-4 shrink-0" aria-hidden="true" />}
              dataUsageInformationSection
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="text-ko-pretty text-sm font-medium leading-6 text-foreground">
                  {isOnlineService ? "온라인 서비스" : partner.location}
                </p>
                {showBranchScope ? (
                  <Badge variant="warning" className="mt-2">
                    {branchScopeLabel}
                  </Badge>
                ) : null}
                {mapLink ? (
                  <TrackedAnchor
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-control text-foreground shadow-flat transition-interactive hover:-translate-y-px hover:border-strong hover:bg-surface-elevated"
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    eventName="partner_map_click"
                    targetType="partner"
                    targetId={partner.id}
                    properties={{ source: "detail" }}
                    aria-label={placeLinkLabel}
                    title={placeLinkLabel}
                  >
                    {isOnlineService ? (
                      <svg
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M7 17 17 7" />
                        <path d="M8 7h9v9" />
                      </svg>
                    ) : (
                      <MapPinIcon className="size-4" aria-hidden="true" />
                    )}
                  </TrackedAnchor>
                ) : null}
              </div>
            </PartnerDetailInfoRow>

            <PartnerDetailInfoRow
              label="적용 대상"
              icon={<UserGroupIcon className="size-4 shrink-0" aria-hidden="true" />}
              dataUsageInformationSection
            >
              <PartnerAudienceChips
                appliesTo={partner.appliesTo}
                className="grid min-w-0 grid-cols-2 gap-1.5 min-[480px]:grid-cols-3 sm:gap-2"
                itemClassName="min-w-0"
                badgeClassName="min-h-9 w-full !border-primary !bg-primary px-1 text-[11px] tracking-[0.02em] !text-primary-foreground shadow-flat sm:px-3 sm:text-xs sm:tracking-[0.04em]"
                inactiveBadgeClassName="min-h-9 w-full border-dashed border-border bg-transparent px-1 text-[11px] tracking-[0.02em] text-foreground sm:px-3 sm:text-xs sm:tracking-[0.04em]"
                showAllOptions
              />
            </PartnerDetailInfoRow>
          </div>

          {hasAdditionalInformation ? (
            <details className="group overflow-hidden rounded-[1.25rem] border border-border/80 bg-surface-inset">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 sm:px-5">
              <span
                data-additional-information-summary
                className="min-w-0 truncate text-sm font-semibold"
                title={`이용 조건과 제휴처 정보 · ${additionalInformationSummary}`}
              >
                이용 조건과 제휴처 정보
                <span className="font-normal text-muted-foreground">
                  {` · ${additionalInformationSummary}`}
                </span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="grid gap-5 border-t border-border/70 bg-surface px-4 py-5 sm:px-5">
              {partner.conditions.length > 0 ? (
                <div>
                  <p className="ui-caption">이용 조건</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {partner.conditions.map((condition) => (
                      <PartnerValueBadge key={condition}>
                        {condition}
                      </PartnerValueBadge>
                    ))}
                  </div>
                </div>
              ) : null}
              {showBranchScope || partner.branchScopeNote ? (
                <div>
                  <p className="ui-caption">적용 지점</p>
                  <p className="text-ko-pretty mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {partner.branchScopeNote?.trim() || `${branchScopeLabel}에 적용됩니다.`}
                  </p>
                </div>
              ) : null}
              {partner.detailDescription ? (
                <div>
                  <p className="ui-caption">제휴처 소개</p>
                  <p className="text-ko-pretty mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {partner.detailDescription}
                  </p>
                </div>
              ) : null}
              {(partner.tags?.length ?? 0) > 0 ? (
                <div>
                  <p className="ui-caption">태그</p>
                  <ul
                    data-partner-tag-list
                    aria-label="제휴처 태그"
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    {(partner.tags ?? []).map((tag) => (
                      <li key={tag} data-partner-tag>
                        <Chip style={chipStyle}>#{tag}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            </details>
          ) : null}
        </section>

        {primaryActionPanel ? (
          <div data-primary-benefit-action-panel className="pt-1">
            {primaryActionPanel}
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
