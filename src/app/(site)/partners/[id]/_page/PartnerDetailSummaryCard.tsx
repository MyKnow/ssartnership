import type { CSSProperties, ReactNode } from "react";
import {
  MapPinIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import TrackedAnchor from "@/components/analytics/TrackedAnchor";
import Badge from "@/components/ui/Badge";
import Chip from "@/components/ui/Chip";
import PageSection from "@/components/ui/PageSection";
import Surface from "@/components/ui/Surface";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import {
  getPartnerPlaceLinkLabel,
  getPartnerServiceMode,
} from "@/lib/partner-service-mode";
import { getPartnerBranchScopeLabel } from "@/lib/partner-branch-registration";
import type { Partner } from "@/lib/types";
import PartnerDetailInfoRow from "./PartnerDetailInfoRow";

function PartnerDetailNumberedList({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: string[];
}) {
  return (
    <ol
      aria-label={ariaLabel}
      className={
        items.length > 1
          ? "grid gap-px overflow-hidden rounded-[1.4rem] border border-border/80 bg-border/80 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"
          : "grid gap-px overflow-hidden rounded-[1.4rem] border border-border/80 bg-border/80"
      }
    >
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex min-w-0 items-start gap-3 bg-surface-inset p-4 sm:p-5"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary-soft text-[11px] font-bold tabular-nums text-primary"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-ko-pretty min-w-0 pt-1 text-sm font-semibold leading-6 text-foreground sm:text-base">
            {item}
          </span>
        </li>
      ))}
    </ol>
  );
}

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
  const detailDescription = partner.detailDescription?.trim() ?? "";
  const tags = (partner.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const hasBranchInformation = Boolean(showBranchScope || partner.branchScopeNote);

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
        {detailDescription ? (
          <PageSection title="제휴처 소개" data-partner-introduction-section>
            <Surface
              level="inset"
              padding="md"
              data-partner-introduction-container
            >
              <p
                data-partner-introduction-content
                className="text-ko-pretty whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base"
              >
                {detailDescription}
              </p>
            </Surface>
          </PageSection>
        ) : null}

        <PageSection title="받을 수 있는 혜택">
          {partner.benefits.length > 0 ? (
            <PartnerDetailNumberedList ariaLabel="제휴 혜택" items={partner.benefits} />
          ) : (
            <Surface level="inset" padding="md">
              <p className="ui-body">등록된 혜택 정보가 없습니다.</p>
            </Surface>
          )}
        </PageSection>

        {partner.conditions.length > 0 ? (
          <PageSection title="이용 조건" data-partner-benefit-conditions>
            <PartnerDetailNumberedList ariaLabel="이용 조건" items={partner.conditions} />
          </PageSection>
        ) : null}

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
                inactiveBadgeClassName="min-h-9 w-full border-border/45 bg-surface-muted/35 px-1 text-[11px] tracking-[0.02em] text-muted-foreground shadow-none sm:px-3 sm:text-xs sm:tracking-[0.04em]"
                showAllOptions
              />
            </PartnerDetailInfoRow>
          </div>

          {hasBranchInformation ? (
            <section
              data-additional-information-section
              aria-labelledby={`partner-detail-additional-information-${partner.id}`}
              className="grid min-w-0 gap-5 border-t border-border/70 pt-5"
            >
              <h3
                id={`partner-detail-additional-information-${partner.id}`}
                className="ui-section-title text-ko-title text-balance"
              >
                추가 정보
              </h3>
              <div className="grid min-w-0 gap-5">
                <div>
                  <p className="ui-caption">적용 지점</p>
                  <p className="text-ko-pretty mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {partner.branchScopeNote?.trim() || `${branchScopeLabel}에 적용됩니다.`}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {tags.length > 0 ? (
            <section
              data-partner-tags-section
              aria-labelledby={`partner-detail-tags-${partner.id}`}
              className="grid min-w-0 gap-5 border-t border-border/70 pt-5"
            >
              <h3
                id={`partner-detail-tags-${partner.id}`}
                className="ui-section-title text-ko-title text-balance"
              >
                태그
              </h3>
              <ul
                data-partner-tag-list
                aria-label="제휴처 태그"
                className="flex flex-wrap gap-2"
              >
                {tags.map((tag) => (
                  <li key={tag} data-partner-tag>
                    <Chip style={chipStyle}>#{tag}</Chip>
                  </li>
                ))}
              </ul>
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
