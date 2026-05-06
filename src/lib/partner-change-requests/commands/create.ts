import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import { normalizeCampusSlugs } from "../../campuses.ts";
import { getSupabaseAdminClient } from "../../supabase/server.ts";
import {
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateDateRange,
} from "../../validation.ts";
import { getSupabaseRequestContext } from "../context.ts";
import {
  arraysEqual,
  normalizeAudience,
  normalizeHttpUrlList,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeTextList,
} from "../normalizers.ts";
import { toSummary } from "../summary.ts";
import {
  REQUEST_SELECT,
  type PartnerChangeRequestCreateInput,
  type PartnerChangeRequestRow,
  wrapPartnerChangeRequestDbError,
} from "../shared.ts";

export async function createSupabaseRequest(
  input: PartnerChangeRequestCreateInput,
) {
  const context = await getSupabaseRequestContext(input.companyIds, input.partnerId);
  if (!context) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 브랜드의 변경 요청을 만들 수 없습니다.",
    );
  }
  if (context.pendingRequest) {
    throw new PartnerChangeRequestError(
      "pending_exists",
      "이미 승인 대기 중인 요청이 있습니다.",
    );
  }

  const requestedConditions = normalizeTextList(input.requestedConditions);
  const requestedBenefits = normalizeTextList(input.requestedBenefits);
  const requestedAppliesTo = normalizeAudience(input.requestedAppliesTo);
  const requestedTags = normalizeTextList(input.requestedTags);
  const requestedPartnerName = normalizeRequiredText(input.requestedPartnerName);
  const requestedPartnerLocation = normalizeRequiredText(
    input.requestedPartnerLocation,
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
      "브랜드명과 위치를 입력해 주세요.",
    );
  }
  if (requestedCampusSlugs.length === 0) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "노출 캠퍼스를 하나 이상 선택해 주세요.",
    );
  }

  if (
    context.partnerName === requestedPartnerName &&
    context.partnerLocation === requestedPartnerLocation &&
    context.mapUrl === requestedMapUrl &&
    arraysEqual(context.currentCampusSlugs, requestedCampusSlugs) &&
    requestedConditions.length === 0 &&
    requestedBenefits.length === 0 &&
    requestedAppliesTo.length === 0 &&
    !requestedPeriodStart &&
    !requestedPeriodEnd
  ) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "변경 요청 값을 입력해 주세요.",
    );
  }

  if (
    context.partnerName === requestedPartnerName &&
    context.partnerLocation === requestedPartnerLocation &&
    context.mapUrl === requestedMapUrl &&
    arraysEqual(context.currentCampusSlugs, requestedCampusSlugs) &&
    arraysEqual(context.currentConditions, requestedConditions) &&
    arraysEqual(context.currentBenefits, requestedBenefits) &&
    arraysEqual(context.currentAppliesTo, requestedAppliesTo) &&
    context.periodStart === requestedPeriodStart &&
    context.periodEnd === requestedPeriodEnd
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 요청을 보낼 수 없습니다.",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { error: companyAccessError } = await supabase
    .from("partner_account_companies")
    .select("id")
    .eq("account_id", input.requestedByAccountId)
    .eq("company_id", context.companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (companyAccessError) {
    throw wrapPartnerChangeRequestDbError(
      companyAccessError,
      "변경 요청 권한을 확인하지 못했습니다.",
    );
  }

  const { data: created, error } = await supabase
    .from("partner_change_requests")
    .insert({
      company_id: context.companyId,
      partner_id: input.partnerId,
      requested_by_account_id: input.requestedByAccountId,
      status: "pending",
      current_partner_name: context.partnerName,
      current_partner_location: context.partnerLocation,
      current_map_url: context.mapUrl,
      current_campus_slugs: context.currentCampusSlugs,
      current_conditions: context.currentConditions,
      current_benefits: context.currentBenefits,
      current_applies_to: context.currentAppliesTo,
      current_tags: context.currentTags,
      current_thumbnail: context.thumbnail,
      current_images: context.images,
      current_reservation_link: context.reservationLink,
      current_inquiry_link: context.inquiryLink,
      current_period_start: context.periodStart,
      current_period_end: context.periodEnd,
      requested_partner_name: requestedPartnerName,
      requested_partner_location: requestedPartnerLocation,
      requested_map_url: requestedMapUrl,
      requested_campus_slugs: requestedCampusSlugs,
      requested_conditions: requestedConditions,
      requested_benefits: requestedBenefits,
      requested_applies_to: requestedAppliesTo,
      requested_tags: requestedTags,
      requested_thumbnail: requestedThumbnail,
      requested_images: requestedImages,
      requested_reservation_link: requestedReservationLink,
      requested_inquiry_link: requestedInquiryLink,
      requested_period_start: requestedPeriodStart,
      requested_period_end: requestedPeriodEnd,
    })
    .select(REQUEST_SELECT)
    .single();

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청을 저장하지 못했습니다.",
    );
  }

  const summary = created ? toSummary(created as PartnerChangeRequestRow) : null;
  if (!summary) {
    throw new PartnerChangeRequestError(
      "not_found",
      "요청을 저장하지 못했습니다.",
    );
  }

  return summary;
}
