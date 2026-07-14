import { deletePartnerMediaUrls } from "../../partner-media-storage.ts";
import { buildAtomicAuditRpcContext } from "../../audit-rpc-context.ts";
import { buildAdminMutationAuditProperties } from "../../admin-mutation-audit.ts";
import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import { getSupabaseAdminClient } from "../../supabase/server.ts";
import { collectRemovedPartnerMediaUrls } from "../media-cleanup.ts";
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
  if (!input.auditContext) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "감사 요청 문맥이 없어 변경 요청을 승인할 수 없습니다.",
    );
  }
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
      "현재 제휴처 정보를 불러오지 못했습니다.",
    );
  }
  if (!currentPartner) {
    throw new PartnerChangeRequestError(
      "not_found",
      "대상 파트너사를 찾을 수 없습니다.",
    );
  }

  const { error } = await supabase.rpc(
    "resolve_partner_change_request_with_audit",
    {
      p_change_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_decision: "approved",
      ...buildAtomicAuditRpcContext(input.auditContext, buildApprovalAuditProperties(summary)),
    },
  );

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청을 승인하지 못했습니다.",
    );
  }

  const currentMediaUrls = collectPartnerMediaUrls(currentPartner as {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null);
  const removedMediaUrls = collectRemovedPartnerMediaUrls(
    currentMediaUrls,
    collectPartnerChangeRequestRequestedMediaUrls(summary),
  );
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
  if (!input.auditContext) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "감사 요청 문맥이 없어 변경 요청을 거절할 수 없습니다.",
    );
  }
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
      "현재 제휴처 정보를 불러오지 못했습니다.",
    );
  }

  const { error } = await supabase.rpc(
    "resolve_partner_change_request_with_audit",
    {
      p_change_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_decision: "rejected",
      ...buildAtomicAuditRpcContext(input.auditContext, buildRejectionAuditProperties(summary)),
    },
  );

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청을 거절하지 못했습니다.",
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

function buildApprovalAuditProperties(summary: ReturnType<typeof toSummary>) {
  const changedFields = [
    ["name", summary.currentPartnerName, summary.requestedPartnerName],
    ["location", summary.currentPartnerLocation, summary.requestedPartnerLocation],
    ["detailDescription", summary.currentDetailDescription, summary.requestedDetailDescription],
    ["mapUrl", summary.currentMapUrl, summary.requestedMapUrl],
    ["campusSlugs", summary.currentCampusSlugs, summary.requestedCampusSlugs],
    ["conditions", summary.currentConditions, summary.requestedConditions],
    ["benefits", summary.currentBenefits, summary.requestedBenefits],
    ["appliesTo", summary.currentAppliesTo, summary.requestedAppliesTo],
    ["tags", summary.currentTags, summary.requestedTags],
    ["thumbnail", summary.currentThumbnail, summary.requestedThumbnail],
    ["images", summary.currentImages, summary.requestedImages],
    ["reservationLink", summary.currentReservationLink, summary.requestedReservationLink],
    ["inquiryLink", summary.currentInquiryLink, summary.requestedInquiryLink],
    ["periodStart", summary.currentPeriodStart, summary.requestedPeriodStart],
    ["periodEnd", summary.currentPeriodEnd, summary.requestedPeriodEnd],
  ]
    .filter(([, before, after]) => JSON.stringify(before) !== JSON.stringify(after))
    .map(([field]) => field);

  return buildAdminMutationAuditProperties({
    outcome: "success",
    properties: {
      requestId: summary.id,
      partnerId: summary.partnerId,
      partnerName: summary.partnerName,
      companyId: summary.companyId,
      companyName: summary.companyName,
      changedFields,
    },
  });
}

function buildRejectionAuditProperties(summary: ReturnType<typeof toSummary>) {
  return buildAdminMutationAuditProperties({
    outcome: "success",
    properties: {
      requestId: summary.id,
      partnerId: summary.partnerId,
      partnerName: summary.partnerName,
      companyId: summary.companyId,
      companyName: summary.companyName,
      requestedTagsCount: summary.requestedTags.length,
      requestedThumbnail: Boolean(summary.requestedThumbnail),
      requestedImagesCount: summary.requestedImages.length,
      requestedReservationLink: Boolean(summary.requestedReservationLink),
      requestedInquiryLink: Boolean(summary.requestedInquiryLink),
      requestedPeriodStart: summary.requestedPeriodStart,
      requestedPeriodEnd: summary.requestedPeriodEnd,
    },
  });
}
