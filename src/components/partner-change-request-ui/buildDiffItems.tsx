import type { ReactNode } from "react";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";
import {
  arraysEqual,
  CURRENT_DIFF_BADGE_CLASS,
  DiffLink,
  DiffText,
  formatRange,
  ListChips,
  REQUESTED_DIFF_BADGE_CLASS,
} from "./DiffPrimitives";

export type PartnerChangeRequestDiffItem = {
  key: string;
  label: string;
  current: ReactNode;
  requested: ReactNode;
};

export function buildPartnerChangeRequestDiffItems(
  request: PartnerChangeRequestSummary | null,
): PartnerChangeRequestDiffItem[] {
  if (!request) {
    return [];
  }

  const items: Array<PartnerChangeRequestDiffItem | null> = [
    request.currentPartnerName !== request.requestedPartnerName
      ? {
          key: "partnerName",
          label: "브랜드명",
          current: <DiffText tone="current">{request.currentPartnerName}</DiffText>,
          requested: <DiffText tone="requested">{request.requestedPartnerName}</DiffText>,
        }
      : null,
    request.currentPartnerLocation !== request.requestedPartnerLocation
      ? {
          key: "partnerLocation",
          label: "위치",
          current: <DiffText tone="current">{request.currentPartnerLocation}</DiffText>,
          requested: (
            <DiffText tone="requested">{request.requestedPartnerLocation}</DiffText>
          ),
        }
      : null,
    request.currentMapUrl !== request.requestedMapUrl
      ? {
          key: "mapUrl",
          label: "지도 URL",
          current: <DiffLink tone="current" href={request.currentMapUrl} />,
          requested: <DiffLink tone="requested" href={request.requestedMapUrl} />,
        }
      : null,
    !arraysEqual(request.currentConditions, request.requestedConditions)
      ? {
          key: "conditions",
          label: "이용 조건",
          current: (
            <ListChips
              values={request.currentConditions}
              emptyText="조건이 없습니다."
              badgeClassName={CURRENT_DIFF_BADGE_CLASS}
            />
          ),
          requested: (
            <ListChips
              values={request.requestedConditions}
              emptyText="조건이 없습니다."
              badgeClassName={REQUESTED_DIFF_BADGE_CLASS}
            />
          ),
        }
      : null,
    !arraysEqual(request.currentBenefits, request.requestedBenefits)
      ? {
          key: "benefits",
          label: "혜택",
          current: (
            <ListChips
              values={request.currentBenefits}
              emptyText="혜택이 없습니다."
              badgeClassName={CURRENT_DIFF_BADGE_CLASS}
            />
          ),
          requested: (
            <ListChips
              values={request.requestedBenefits}
              emptyText="혜택이 없습니다."
              badgeClassName={REQUESTED_DIFF_BADGE_CLASS}
            />
          ),
        }
      : null,
    !arraysEqual(request.currentAppliesTo, request.requestedAppliesTo)
      ? {
          key: "appliesTo",
          label: "적용 대상",
          current: (
            <PartnerAudienceChips
              appliesTo={request.currentAppliesTo}
              badgeClassName={CURRENT_DIFF_BADGE_CLASS}
            />
          ),
          requested: (
            <PartnerAudienceChips
              appliesTo={request.requestedAppliesTo}
              badgeClassName={REQUESTED_DIFF_BADGE_CLASS}
            />
          ),
        }
      : null,
    request.currentPeriodStart !== request.requestedPeriodStart ||
    request.currentPeriodEnd !== request.requestedPeriodEnd
      ? {
          key: "period",
          label: "기간",
          current: (
            <DiffText tone="current">
              {formatRange(request.currentPeriodStart, request.currentPeriodEnd)}
            </DiffText>
          ),
          requested: (
            <DiffText tone="requested">
              {formatRange(request.requestedPeriodStart, request.requestedPeriodEnd)}
            </DiffText>
          ),
        }
      : null,
  ];

  return items.filter((item): item is PartnerChangeRequestDiffItem => Boolean(item));
}
