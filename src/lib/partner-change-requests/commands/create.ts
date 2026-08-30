import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import { getSupabaseAdminClient } from "../../supabase/server.ts";
import { getSupabaseRequestContext } from "../context.ts";
import {
  assertPartnerChangeRequestHasChanges,
  normalizePartnerChangeRequestCreateFields,
} from "../contracts.ts";
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
      "해당 제휴처의 변경 요청을 만들 수 없습니다.",
    );
  }
  if (context.pendingRequest) {
    throw new PartnerChangeRequestError(
      "pending_exists",
      "이미 승인 대기 중인 요청이 있습니다.",
    );
  }

  const normalized = normalizePartnerChangeRequestCreateFields(input);
  assertPartnerChangeRequestHasChanges(
    {
      partnerName: context.partnerName,
      partnerLocation: context.partnerLocation,
      detailDescription: context.detailDescription,
      mapUrl: context.mapUrl,
      campusSlugs: context.currentCampusSlugs,
      conditions: context.currentConditions,
      benefits: context.currentBenefits,
      appliesTo: context.currentAppliesTo,
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
    },
    normalized,
  );
  const {
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
  } = normalized;

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
      current_detail_description: context.detailDescription,
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
      requested_detail_description: requestedDetailDescription,
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
