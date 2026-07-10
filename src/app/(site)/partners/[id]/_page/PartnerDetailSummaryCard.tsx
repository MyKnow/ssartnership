import type { CSSProperties } from "react";
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
import { applyContentBudget } from "@/lib/content-budget";
import type { Partner } from "@/lib/types";

export default function PartnerDetailSummaryCard({
  partner,
  categoryLabel,
  badgeStyle,
  chipStyle,
  mapLink,
  currentUserId,
  isFavorited,
  metrics,
}: {
  partner: Partner;
  categoryLabel: string;
  badgeStyle?: CSSProperties;
  chipStyle?: CSSProperties;
  mapLink?: string;
  currentUserId?: string | null;
  isFavorited?: boolean;
  metrics?: PartnerPortalServiceMetrics | null;
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
  const tagBudget = applyContentBudget(partner.tags ?? [], 4);
  const hasAdditionalInformation = Boolean(
    partner.conditions.length > 0 ||
      partner.detailDescription ||
      partner.branchScopeNote ||
      (partner.tags?.length ?? 0) > 0,
  );

  return (
    <Surface
      level="default"
      padding="lg"
      className="order-1 min-w-0 xl:order-1"
      data-partner-detail-summary
    >
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <span className="text-xs font-medium text-muted-foreground">
            {partner.period.start} ~ {partner.period.end}
          </span>
        </div>

        <PageSection
          title="받을 수 있는 혜택"
          description="방문하거나 이용하기 전에 적용 대상과 기간을 확인하세요."
        >
          <div className="grid gap-2">
            {partner.benefits.length > 0 ? (
              partner.benefits.map((benefit) => (
                <Surface
                  key={benefit}
                  level="inset"
                  padding="sm"
                  className="text-ko-pretty font-semibold text-foreground"
                >
                  {benefit}
                </Surface>
              ))
            ) : (
              <p className="ui-body">등록된 혜택 정보가 없습니다.</p>
            )}
          </div>
        </PageSection>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {!isOnlineService ? <span>{partner.location}</span> : null}
          {showBranchScope ? (
            <Badge variant="warning">{branchScopeLabel}</Badge>
          ) : null}
          {mapLink ? (
            <TrackedAnchor
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
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
                  <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
                  <path d="M9 3v15" />
                  <path d="M15 6v15" />
                </svg>
              )}
            </TrackedAnchor>
          ) : null}
        </div>

        <div>
          <p className="ui-caption">적용 대상</p>
          <PartnerAudienceChips appliesTo={partner.appliesTo} className="mt-2" />
        </div>

        {hasAdditionalInformation ? (
          <details className="group border-t border-border/70 pt-2">
            <summary className="ui-label flex min-h-11 cursor-pointer list-none items-center justify-between rounded-[1rem] px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25">
              이용 조건과 제휴처 정보
              <span aria-hidden="true" className="text-muted-foreground group-open:rotate-180">
                ↓
              </span>
            </summary>
            <div className="grid gap-5 pt-4">
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
              {tagBudget.visible.length > 0 ? (
                <div>
                  <p className="ui-caption">태그</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tagBudget.visible.map((tag) => (
                      <Chip key={tag} style={chipStyle}>
                        #{tag}
                      </Chip>
                    ))}
                    {tagBudget.hiddenCount > 0 ? (
                      <Chip>+{tagBudget.hiddenCount}</Chip>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </Surface>
  );
}
