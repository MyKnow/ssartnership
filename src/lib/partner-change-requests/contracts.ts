import type { AtomicAuditContext } from "../audit-rpc-context.ts";
import { normalizeCampusSlugs } from "../campuses.ts";
import { parsePartnerAudienceSelection } from "../partner-audience.ts";
import { PartnerChangeRequestError } from "../partner-change-request-errors.ts";
import { normalizePartnerDetailDescription } from "../partner-detail-description.ts";
import {
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateDateRange,
} from "../validation.ts";
import {
  arraysEqual,
  normalizeHttpUrlList,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeTextList,
} from "./normalizers.ts";
import type { PartnerChangeRequestCreateInput } from "./shared.ts";

export function requirePartnerChangeRequestAuditContext(
  auditContext: AtomicAuditContext | null | undefined,
  message: string,
) {
  if (!auditContext) {
    throw new PartnerChangeRequestError("invalid_request", message);
  }
  return auditContext;
}

export function normalizePartnerChangeRequestCreateFields(
  input: PartnerChangeRequestCreateInput,
) {
  const requestedConditions = normalizeTextList(input.requestedConditions);
  const requestedBenefits = normalizeTextList(input.requestedBenefits);
  const requestedAppliesTo = parsePartnerAudienceSelection(
    input.requestedAppliesTo,
  );
  const requestedTags = normalizeTextList(input.requestedTags);
  const requestedPartnerName = normalizeRequiredText(input.requestedPartnerName);
  const requestedPartnerLocation = normalizeRequiredText(
    input.requestedPartnerLocation,
  );
  const requestedDetailDescription = normalizePartnerDetailDescription(
    input.requestedDetailDescription,
  );
  const requestedMapUrl = sanitizeHttpUrl(input.requestedMapUrl ?? undefined);
  const requestedCampusSlugs = normalizeCampusSlugs(input.requestedCampusSlugs);
  const requestedThumbnail = normalizeOptionalText(input.requestedThumbnail);
  const requestedImages = normalizeHttpUrlList(input.requestedImages);
  const requestedReservationLink = sanitizePartnerLinkValue(
    input.requestedReservationLink ?? undefined,
  );
  const requestedInquiryLink = sanitizePartnerLinkValue(
    input.requestedInquiryLink ?? undefined,
  );
  const requestedPeriodStart = normalizeOptionalText(input.requestedPeriodStart);
  const requestedPeriodEnd = normalizeOptionalText(input.requestedPeriodEnd);

  const dateRangeError = validateDateRange(
    requestedPeriodStart,
    requestedPeriodEnd,
  );
  if (dateRangeError) {
    throw new PartnerChangeRequestError("invalid_request", dateRangeError);
  }
  if (!requestedPartnerName || !requestedPartnerLocation) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "제휴처명과 지점 위치를 입력해 주세요.",
    );
  }
  if (requestedCampusSlugs.length === 0) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "노출 캠퍼스를 하나 이상 선택해 주세요.",
    );
  }
  if (!requestedAppliesTo) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "적용 대상을 하나 이상 선택해 주세요.",
    );
  }

  return {
    requestedConditions,
    requestedBenefits,
    requestedAppliesTo,
    requestedTags,
    requestedPartnerName,
    requestedPartnerLocation,
    requestedDetailDescription,
    requestedMapUrl,
    requestedCampusSlugs,
    requestedThumbnail,
    requestedImages,
    requestedReservationLink,
    requestedInquiryLink,
    requestedPeriodStart,
    requestedPeriodEnd,
  };
}

export function assertPartnerChangeRequestHasChanges(
  current: {
    partnerName: string;
    partnerLocation: string;
    detailDescription: string | null;
    mapUrl: string | null;
    campusSlugs: string[];
    conditions: string[];
    benefits: string[];
    appliesTo: string[];
    periodStart: string | null;
    periodEnd: string | null;
  },
  requested: ReturnType<typeof normalizePartnerChangeRequestCreateFields>,
) {
  const coreFieldsAreUnchanged =
    current.partnerName === requested.requestedPartnerName &&
    current.partnerLocation === requested.requestedPartnerLocation &&
    current.detailDescription === requested.requestedDetailDescription &&
    current.mapUrl === requested.requestedMapUrl &&
    arraysEqual(current.campusSlugs, requested.requestedCampusSlugs);

  if (
    coreFieldsAreUnchanged &&
    arraysEqual(current.conditions, requested.requestedConditions) &&
    arraysEqual(current.benefits, requested.requestedBenefits) &&
    arraysEqual(current.appliesTo, requested.requestedAppliesTo) &&
    current.periodStart === requested.requestedPeriodStart &&
    current.periodEnd === requested.requestedPeriodEnd
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 요청을 보낼 수 없습니다.",
    );
  }
}
