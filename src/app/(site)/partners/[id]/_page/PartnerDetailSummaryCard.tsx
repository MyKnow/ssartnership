import type { CSSProperties, ReactNode } from "react";
import {
  CalendarDaysIcon,
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
import {
  getPartnerPlaceLinkLabel,
  getPartnerServiceMode,
} from "@/lib/partner-service-mode";
import { getPartnerBranchScopeLabel } from "@/lib/partner-branch-registration";
import type { Partner } from "@/lib/types";
import PartnerDetailInfoRow from "./PartnerDetailInfoRow";

export default function PartnerDetailSummaryCard({
  partner,
  chipStyle,
  mapLink,
  detailPanel,
  primaryActionPanel,
}: {
  partner: Partner;
  chipStyle?: CSSProperties;
  mapLink?: string;
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
    partner.period.start ||
      partner.period.end ||
      partner.conditions.length > 0 ||
      showBranchScope ||
      partner.branchScopeNote ||
      (partner.tags?.length ?? 0) > 0,
  );

  return (
    <Surface
      level="elevated"
      padding="lg"
      className="min-w-0 overflow-hidden"
      data-partner-detail-summary
    >
      <div
        data-partner-detail-summary-content
        className="flex min-w-0 flex-col gap-7"
      >
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
            <section
              data-additional-information-section
              aria-labelledby={`partner-detail-additional-information-${partner.id}`}
              className="grid min-w-0 gap-5 border-t border-border/70 pt-5"
            >
              <h3
                id={`partner-detail-additional-information-${partner.id}`}
                className="ui-section-title text-ko-title text-balance"
              >
                이용조건 및 태그
              </h3>
              <div className="grid min-w-0 gap-5">
                {partner.period.start || partner.period.end ? (
                  <div data-partner-period>
                    <p className="ui-caption">이용 기간</p>
                    <div
                      aria-label={`이용 기간 ${partner.period.start}부터 ${partner.period.end}까지`}
                      className="mt-2 inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-border/80 bg-surface-inset px-4 py-1 text-xs font-semibold text-foreground"
                    >
                      <CalendarDaysIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="whitespace-nowrap tabular-nums">
                        {partner.period.start} – {partner.period.end}
                      </span>
                    </div>
                  </div>
                ) : null}
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
            </section>
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
