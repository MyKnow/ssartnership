import { deletePartnerMediaUrls } from "../../partner-media-storage.ts";
import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import { getSupabaseAdminClient } from "../../supabase/server.ts";
import { fetchRequestSummary, toSummary } from "../summary.ts";
import {
  collectPartnerChangeRequestRequestedMediaUrls,
  collectPartnerMediaUrls,
} from "../normalizers.ts";
import {
  REQUEST_SELECT,
  type PartnerChangeRequestReviewInput,
  type PartnerChangeRequestRow,
  wrapPartnerChangeRequestDbError,
} from "../shared.ts";

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
