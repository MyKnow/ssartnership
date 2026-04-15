import { deletePartnerMediaUrls } from "../partner-media-storage.ts";
import { PartnerChangeRequestError } from "../partner-change-request-errors.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import { sanitizeHttpUrl, sanitizePartnerLinkValue, validateDateRange } from "../validation.ts";
import { getSupabaseRequestContext } from "./context.ts";
import {
  arraysEqual,
  collectPartnerChangeRequestRequestedMediaUrls,
  collectPartnerMediaUrls,
  normalizeAudience,
  normalizeHttpUrlList,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeTextList,
} from "./normalizers.ts";
import { fetchRequestSummary, toSummary } from "./summary.ts";
import {
  normalizeCompanyIds,
  REQUEST_SELECT,
  type PartnerChangeRequestCancelInput,
  type PartnerChangeRequestCreateInput,
  type PartnerChangeRequestReviewInput,
  type PartnerChangeRequestRow,
  wrapPartnerChangeRequestDbError,
} from "./shared.ts";

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

  if (
    context.partnerName === requestedPartnerName &&
    context.partnerLocation === requestedPartnerLocation &&
    context.mapUrl === requestedMapUrl &&
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

export async function cancelSupabaseRequest(input: PartnerChangeRequestCancelInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw wrapPartnerChangeRequestDbError(
      requestError,
      "변경 요청을 불러오지 못했습니다.",
    );
  }
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }

  const summary = toSummary(request as PartnerChangeRequestRow);
  if (summary.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }

  const { data: currentPartner, error: currentPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", summary.partnerId)
    .maybeSingle();

  if (currentPartnerError) {
    throw wrapPartnerChangeRequestDbError(
      currentPartnerError,
      "현재 브랜드 정보를 불러오지 못했습니다.",
    );
  }

  if (
    summary.requestedByAccountId !== input.accountId ||
    !normalizeCompanyIds(input.companyIds).includes(summary.companyId)
  ) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 요청을 취소할 수 없습니다.",
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_change_requests")
    .update({
      status: "cancelled",
      cancelled_by_account_id: input.accountId,
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", input.requestId);

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 상태를 저장하지 못했습니다.",
    );
  }

  const cancelled = await fetchRequestSummary(supabase, input.requestId);
  if (!cancelled) {
    throw new PartnerChangeRequestError(
      "not_found",
      "취소된 요청을 확인하지 못했습니다.",
    );
  }

  const currentMediaUrls = collectPartnerMediaUrls(currentPartner as {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null);
  const requestedMediaUrls =
    collectPartnerChangeRequestRequestedMediaUrls(cancelled);
  await deletePartnerMediaUrls(
    requestedMediaUrls.filter((url) => !currentMediaUrls.includes(url)),
  ).catch(() => undefined);

  return cancelled;
}

export async function approveSupabaseRequest(input: PartnerChangeRequestReviewInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw wrapPartnerChangeRequestDbError(
      requestError,
      "변경 요청을 불러오지 못했습니다.",
    );
  }
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }

  const summary = toSummary(request as PartnerChangeRequestRow);
  if (summary.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }

  const { data: currentPartner, error: currentPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", summary.partnerId)
    .maybeSingle();

  if (currentPartnerError) {
    throw wrapPartnerChangeRequestDbError(
      currentPartnerError,
      "현재 브랜드 정보를 불러오지 못했습니다.",
    );
  }
  if (!currentPartner) {
    throw new PartnerChangeRequestError(
      "not_found",
      "대상 협력사를 찾을 수 없습니다.",
    );
  }

  const { error: updatePartnerError } = await supabase
    .from("partners")
    .update({
      name: summary.requestedPartnerName,
      location: summary.requestedPartnerLocation,
      map_url: summary.requestedMapUrl,
      conditions: summary.requestedConditions,
      benefits: summary.requestedBenefits,
      applies_to: summary.requestedAppliesTo,
      period_start: summary.requestedPeriodStart,
      period_end: summary.requestedPeriodEnd,
    })
    .eq("id", summary.partnerId);

  if (updatePartnerError) {
    throw wrapPartnerChangeRequestDbError(
      updatePartnerError,
      "브랜드 정보를 반영하지 못했습니다.",
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_change_requests")
    .update({
      status: "approved",
      reviewed_by_admin_id: input.adminId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", input.requestId);

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 상태를 저장하지 못했습니다.",
    );
  }

  const currentMediaUrls = collectPartnerMediaUrls(currentPartner as {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null);
  const removedMediaUrls = collectPartnerChangeRequestRequestedMediaUrls(
    summary,
  ).filter((url) => !currentMediaUrls.includes(url));
  await deletePartnerMediaUrls(removedMediaUrls).catch(() => undefined);

  const approved = await fetchRequestSummary(supabase, input.requestId);
  if (!approved) {
    throw new PartnerChangeRequestError(
      "not_found",
      "승인된 요청을 확인하지 못했습니다.",
    );
  }

  return approved;
}

export async function rejectSupabaseRequest(input: PartnerChangeRequestReviewInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw wrapPartnerChangeRequestDbError(
      requestError,
      "변경 요청을 불러오지 못했습니다.",
    );
  }
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }

  const summary = toSummary(request as PartnerChangeRequestRow);
  if (summary.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }

  const { data: currentPartner, error: currentPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", summary.partnerId)
    .maybeSingle();

  if (currentPartnerError) {
    throw wrapPartnerChangeRequestDbError(
      currentPartnerError,
      "현재 브랜드 정보를 불러오지 못했습니다.",
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_change_requests")
    .update({
      status: "rejected",
      reviewed_by_admin_id: input.adminId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", input.requestId);

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 상태를 저장하지 못했습니다.",
    );
  }

  const rejected = await fetchRequestSummary(supabase, input.requestId);
  if (!rejected) {
    throw new PartnerChangeRequestError(
      "not_found",
      "거절된 요청을 확인하지 못했습니다.",
    );
  }

  const currentMediaUrls = collectPartnerMediaUrls(currentPartner as {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null);
  const requestedMediaUrls =
    collectPartnerChangeRequestRequestedMediaUrls(rejected);
  await deletePartnerMediaUrls(
    requestedMediaUrls.filter((url) => !currentMediaUrls.includes(url)),
  ).catch(() => undefined);

  return rejected;
}
