import type { PartnerAudienceKey } from "./partner-audience.ts";
import { normalizePartnerAudience } from "./partner-audience.ts";
import {
  PartnerChangeRequestError,
} from "./partner-change-request-errors.ts";
import { isPartnerPortalMock } from "./partner-portal.ts";
import { normalizePartnerVisibility } from "./partner-visibility.ts";
import type { PartnerVisibility } from "./types.ts";
import {
  deletePartnerMediaUrls,
} from "./partner-media-storage.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";
import {
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateDateRange,
} from "./validation.ts";
import {
  approveMockPartnerChangeRequest,
  cancelMockPartnerChangeRequest,
  createMockPartnerChangeRequest,
  getMockPartnerChangeRequestContext,
  listMockPartnerChangeRequests,
  rejectMockPartnerChangeRequest,
} from "./mock/partner-change-requests.ts";

export type PartnerChangeRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type PartnerChangeRequestSummary = {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  partnerId: string;
  partnerName: string;
  partnerLocation: string;
  categoryLabel: string;
  status: PartnerChangeRequestStatus;
  requestedByAccountId: string | null;
  requestedByLoginId: string | null;
  requestedByDisplayName: string | null;
  currentConditions: string[];
  currentBenefits: string[];
  currentAppliesTo: PartnerAudienceKey[];
  currentTags: string[];
  currentThumbnail: string | null;
  currentImages: string[];
  currentReservationLink: string | null;
  currentInquiryLink: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  requestedConditions: string[];
  requestedBenefits: string[];
  requestedAppliesTo: PartnerAudienceKey[];
  requestedTags: string[];
  requestedThumbnail: string | null;
  requestedImages: string[];
  requestedReservationLink: string | null;
  requestedInquiryLink: string | null;
  requestedPeriodStart: string | null;
  requestedPeriodEnd: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  cancelledByAccountId: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerChangeRequestContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  partnerId: string;
  partnerName: string;
  partnerLocation: string;
  categoryLabel: string;
  categoryColor: string | null;
  visibility: PartnerVisibility;
  periodStart: string | null;
  periodEnd: string | null;
  thumbnail: string | null;
  images: string[];
  tags: string[];
  mapUrl: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  currentConditions: string[];
  currentBenefits: string[];
  currentAppliesTo: PartnerAudienceKey[];
  currentTags: string[];
  currentThumbnail: string | null;
  currentImages: string[];
  currentReservationLink: string | null;
  currentInquiryLink: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pendingRequest: PartnerChangeRequestSummary | null;
};

export type PartnerChangeRequestCreateInput = {
  companyIds: string[];
  partnerId: string;
  requestedByAccountId: string;
  requestedByLoginId: string;
  requestedByDisplayName: string;
  requestedConditions: string[];
  requestedBenefits: string[];
  requestedAppliesTo: PartnerAudienceKey[];
  requestedTags: string[];
  requestedThumbnail: string | null;
  requestedImages: string[];
  requestedReservationLink: string | null;
  requestedInquiryLink: string | null;
  requestedPeriodStart: string | null;
  requestedPeriodEnd: string | null;
};

export type PartnerChangeRequestCancelInput = {
  requestId: string;
  accountId: string;
  companyIds: string[];
};

export type PartnerChangeRequestReviewInput = {
  requestId: string;
  adminId: string;
};

export interface PartnerChangeRequestRepository {
  getRequestContext(
    companyIds: string[],
    partnerId: string,
  ): Promise<PartnerChangeRequestContext | null>;
  listPendingRequests(companyIds?: string[]): Promise<PartnerChangeRequestSummary[]>;
  createRequest(
    input: PartnerChangeRequestCreateInput,
  ): Promise<PartnerChangeRequestSummary>;
  cancelRequest(
    input: PartnerChangeRequestCancelInput,
  ): Promise<PartnerChangeRequestSummary>;
  approveRequest(
    input: PartnerChangeRequestReviewInput,
  ): Promise<PartnerChangeRequestSummary>;
  rejectRequest(
    input: PartnerChangeRequestReviewInput,
  ): Promise<PartnerChangeRequestSummary>;
}

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
};

type PartnerCategoryRow = {
  key?: string | null;
  label?: string | null;
  color?: string | null;
};

type PartnerRow = {
  id: string;
  company_id?: string | null;
  name: string;
  location: string;
  thumbnail?: string | null;
  map_url?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  applies_to?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility?: string | null;
  categories?: PartnerCategoryRow | PartnerCategoryRow[] | null;
  company?:
    | PartnerCompanyRow
    | PartnerCompanyRow[]
    | null;
};

type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
};

type PartnerChangeRequestRow = {
  id: string;
  company_id: string;
  partner_id: string;
  status: PartnerChangeRequestStatus;
  current_conditions?: string[] | null;
  current_benefits?: string[] | null;
  current_applies_to?: string[] | null;
  current_tags?: string[] | null;
  current_thumbnail?: string | null;
  current_images?: string[] | null;
  current_reservation_link?: string | null;
  current_inquiry_link?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  requested_conditions?: string[] | null;
  requested_benefits?: string[] | null;
  requested_applies_to?: string[] | null;
  requested_tags?: string[] | null;
  requested_thumbnail?: string | null;
  requested_images?: string[] | null;
  requested_reservation_link?: string | null;
  requested_inquiry_link?: string | null;
  requested_period_start?: string | null;
  requested_period_end?: string | null;
  requested_by_account_id?: string | null;
  reviewed_by_admin_id?: string | null;
  reviewed_at?: string | null;
  cancelled_by_account_id?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  company?:
    | PartnerCompanyRow
    | PartnerCompanyRow[]
    | null;
  partner?:
    | (PartnerRow & { categories?: PartnerCategoryRow | PartnerCategoryRow[] | null })
    | (PartnerRow & { categories?: PartnerCategoryRow | PartnerCategoryRow[] | null })[]
    | null;
  requested_by?:
    | PartnerAccountRow
    | PartnerAccountRow[]
    | null;
};

const REQUEST_SELECT =
  "id,company_id,partner_id,status,current_conditions,current_benefits,current_applies_to,current_tags,current_thumbnail,current_images,current_reservation_link,current_inquiry_link,current_period_start,current_period_end,requested_conditions,requested_benefits,requested_applies_to,requested_tags,requested_thumbnail,requested_images,requested_reservation_link,requested_inquiry_link,requested_period_start,requested_period_end,requested_by_account_id,reviewed_by_admin_id,reviewed_at,cancelled_by_account_id,cancelled_at,created_at,updated_at,company:partner_companies(id,name,slug),partner:partners(id,name,location,conditions,benefits,applies_to,thumbnail,images,tags,reservation_link,inquiry_link,period_start,period_end,categories(label),company:partner_companies(id,name,slug)),requested_by:partner_accounts(id,login_id,display_name,email)";

function normalizeCompanyIds(companyIds: string[]) {
  return [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
}

function normalizeTextList(values?: string[] | null) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values ?? []) {
    const normalized = String(value ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeHttpUrlList(
  values?: Array<string | null | undefined> | null,
) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values ?? []) {
    const normalized = sanitizeHttpUrl(value ?? undefined);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function extractCategoryLabel(categories: PartnerRow["categories"]) {
  const category = normalizeRelation(categories);
  return category?.label ?? "브랜드";
}

function extractCategoryColor(categories: PartnerRow["categories"]) {
  const category = normalizeRelation(categories);
  return category?.color ?? null;
}

function collectPartnerMediaUrls(row?: {
  thumbnail?: string | null;
  images?: string[] | null;
} | null) {
  if (!row) {
    return [];
  }

  return normalizeHttpUrlList([row.thumbnail ?? null, ...(row.images ?? [])]);
}

export function collectPartnerChangeRequestRequestedMediaUrls(
  request?: Pick<PartnerChangeRequestSummary, "requestedThumbnail" | "requestedImages"> | null,
) {
  if (!request) {
    return [];
  }

  return normalizeHttpUrlList([
    request.requestedThumbnail ?? null,
    ...(request.requestedImages ?? []),
  ]);
}

function normalizeAudience(values?: string[] | null) {
  return normalizePartnerAudience(values);
}

function toSummary(row: PartnerChangeRequestRow): PartnerChangeRequestSummary {
  const company = normalizeRelation(row.company);
  const partner = normalizeRelation(row.partner);
  const requestedBy = normalizeRelation(row.requested_by);

  return {
    id: row.id,
    companyId: row.company_id,
    companyName: company?.name ?? "미지정",
    companySlug: company?.slug ?? "",
    partnerId: row.partner_id,
    partnerName: partner?.name ?? "미지정",
    partnerLocation: partner?.location ?? "",
    categoryLabel: extractCategoryLabel(partner?.categories ?? null),
    status: row.status,
    requestedByAccountId: row.requested_by_account_id ?? null,
    requestedByLoginId: requestedBy?.login_id ?? null,
    requestedByDisplayName: requestedBy?.display_name ?? null,
    currentConditions: normalizeTextList(row.current_conditions),
    currentBenefits: normalizeTextList(row.current_benefits),
    currentAppliesTo: normalizeAudience(row.current_applies_to),
    currentTags: normalizeTextList(row.current_tags),
    currentThumbnail: normalizeOptionalText(row.current_thumbnail),
    currentImages: normalizeHttpUrlList(row.current_images),
    currentReservationLink: normalizeOptionalText(row.current_reservation_link),
    currentInquiryLink: normalizeOptionalText(row.current_inquiry_link),
    currentPeriodStart: normalizeOptionalText(row.current_period_start),
    currentPeriodEnd: normalizeOptionalText(row.current_period_end),
    requestedConditions: normalizeTextList(row.requested_conditions),
    requestedBenefits: normalizeTextList(row.requested_benefits),
    requestedAppliesTo: normalizeAudience(row.requested_applies_to),
    requestedTags: normalizeTextList(row.requested_tags),
    requestedThumbnail: normalizeOptionalText(row.requested_thumbnail),
    requestedImages: normalizeHttpUrlList(row.requested_images),
    requestedReservationLink: normalizeOptionalText(
      row.requested_reservation_link,
    ),
    requestedInquiryLink: normalizeOptionalText(row.requested_inquiry_link),
    requestedPeriodStart: normalizeOptionalText(row.requested_period_start),
    requestedPeriodEnd: normalizeOptionalText(row.requested_period_end),
    reviewedByAdminId: row.reviewed_by_admin_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    cancelledByAccountId: row.cancelled_by_account_id ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchRequestSummary(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  requestId: string,
) {
  const { data, error } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toSummary(data as PartnerChangeRequestRow) : null;
}

async function fetchPendingRequestSummary(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerId: string,
) {
  const { data, error } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("partner_id", partnerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toSummary(data as PartnerChangeRequestRow) : null;
}

async function getSupabaseRequestContext(
  companyIds: string[],
  partnerId: string,
): Promise<PartnerChangeRequestContext | null> {
  const uniqueCompanyIds = normalizeCompanyIds(companyIds);
  if (uniqueCompanyIds.length === 0) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: partner, error } = await supabase
    .from("partners")
    .select(
      "id,company_id,name,location,thumbnail,map_url,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,categories(key,label,color),company:partner_companies(id,name,slug)",
    )
    .eq("id", partnerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!partner) {
    return null;
  }

  const row = partner as PartnerRow;
  if (!row.company_id || !uniqueCompanyIds.includes(row.company_id)) {
    return null;
  }

  const company = normalizeRelation(row.company);
  if (!company) {
    return null;
  }

  const pendingRequest = await fetchPendingRequestSummary(supabase, partnerId);

  return {
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    partnerId: row.id,
    partnerName: row.name,
    partnerLocation: row.location,
    categoryLabel: extractCategoryLabel(row.categories ?? null),
    categoryColor: extractCategoryColor(row.categories ?? null),
    visibility: normalizePartnerVisibility(row.visibility),
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    thumbnail: sanitizeHttpUrl(row.thumbnail ?? undefined),
    images: normalizeHttpUrlList(row.images),
    tags: normalizeTextList(row.tags),
    mapUrl: row.map_url ?? null,
    reservationLink: sanitizePartnerLinkValue(
      row.reservation_link ?? undefined,
    ),
    inquiryLink: sanitizePartnerLinkValue(row.inquiry_link ?? undefined),
    currentConditions: normalizeTextList(row.conditions),
    currentBenefits: normalizeTextList(row.benefits),
    currentAppliesTo: normalizeAudience(row.applies_to),
    currentTags: normalizeTextList(row.tags),
    currentThumbnail: sanitizeHttpUrl(row.thumbnail ?? undefined),
    currentImages: normalizeHttpUrlList(row.images),
    currentReservationLink: sanitizePartnerLinkValue(
      row.reservation_link ?? undefined,
    ),
    currentInquiryLink: sanitizePartnerLinkValue(row.inquiry_link ?? undefined),
    currentPeriodStart: normalizeOptionalText(row.period_start),
    currentPeriodEnd: normalizeOptionalText(row.period_end),
    pendingRequest,
  };
}

async function getSupabasePendingRequests(companyIds?: string[]) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const uniqueCompanyIds = normalizeCompanyIds(companyIds ?? []);
  if (uniqueCompanyIds.length > 0) {
    query = query.in("company_id", uniqueCompanyIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toSummary(row as PartnerChangeRequestRow));
}

async function createSupabaseRequest(
  input: PartnerChangeRequestCreateInput,
): Promise<PartnerChangeRequestSummary> {
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

  if (
    requestedConditions.length === 0 &&
    requestedBenefits.length === 0 &&
    requestedAppliesTo.length === 0 &&
    requestedTags.length === 0 &&
    !requestedThumbnail &&
    requestedImages.length === 0 &&
    !requestedReservationLink &&
    !requestedInquiryLink &&
    !requestedPeriodStart &&
    !requestedPeriodEnd
  ) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "변경 요청 값을 입력해 주세요.",
    );
  }

  if (
    arraysEqual(context.currentConditions, requestedConditions) &&
    arraysEqual(context.currentBenefits, requestedBenefits) &&
    arraysEqual(context.currentAppliesTo, requestedAppliesTo) &&
    arraysEqual(context.currentTags, requestedTags) &&
    context.thumbnail === requestedThumbnail &&
    arraysEqual(context.images, requestedImages) &&
    context.reservationLink === requestedReservationLink &&
    context.inquiryLink === requestedInquiryLink &&
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
    throw new Error(companyAccessError.message);
  }

  const { data: created, error } = await supabase
    .from("partner_change_requests")
    .insert({
      company_id: context.companyId,
      partner_id: input.partnerId,
      requested_by_account_id: input.requestedByAccountId,
      status: "pending",
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
    throw new Error(error.message);
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

async function cancelSupabaseRequest(input: PartnerChangeRequestCancelInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
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
  if (
    summary.requestedByAccountId !== input.accountId ||
    !normalizeCompanyIds(input.companyIds).includes(summary.companyId)
  ) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 요청을 취소할 수 없습니다.",
    );
  }

  const { error } = await supabase
    .from("partner_change_requests")
    .update({
      status: "cancelled",
      cancelled_by_account_id: input.accountId,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId);

  if (error) {
    throw new Error(error.message);
  }

  const cancelled = await fetchRequestSummary(supabase, input.requestId);
  if (!cancelled) {
    throw new PartnerChangeRequestError(
      "not_found",
      "취소된 요청을 확인하지 못했습니다.",
    );
  }
  await deletePartnerMediaUrls(
    collectPartnerChangeRequestRequestedMediaUrls(cancelled),
  ).catch(() => undefined);
  return cancelled;
}

async function approveSupabaseRequest(input: PartnerChangeRequestReviewInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
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

  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", summary.partnerId)
    .maybeSingle();

  if (previousPartnerError) {
    throw new Error(previousPartnerError.message);
  }
  if (!previousPartner) {
    throw new PartnerChangeRequestError(
      "not_found",
      "대상 협력사를 찾을 수 없습니다.",
    );
  }

  const { error: updatePartnerError } = await supabase
    .from("partners")
    .update({
      conditions: summary.requestedConditions,
      benefits: summary.requestedBenefits,
      applies_to: summary.requestedAppliesTo,
      tags: summary.requestedTags,
      thumbnail: summary.requestedThumbnail,
      images: summary.requestedImages,
      reservation_link: summary.requestedReservationLink,
      inquiry_link: summary.requestedInquiryLink,
      period_start: summary.requestedPeriodStart,
      period_end: summary.requestedPeriodEnd,
    })
    .eq("id", summary.partnerId);

  if (updatePartnerError) {
    throw new Error(updatePartnerError.message);
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
    throw new Error(error.message);
  }

  const previousMediaUrls = collectPartnerMediaUrls(previousPartner as {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null);
  const nextMediaUrls = collectPartnerChangeRequestRequestedMediaUrls(summary);
  const removedMediaUrls = previousMediaUrls.filter(
    (url) => !nextMediaUrls.includes(url),
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

async function rejectSupabaseRequest(input: PartnerChangeRequestReviewInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
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
    throw new Error(error.message);
  }

  const rejected = await fetchRequestSummary(supabase, input.requestId);
  if (!rejected) {
    throw new PartnerChangeRequestError(
      "not_found",
      "거절된 요청을 확인하지 못했습니다.",
    );
  }
  await deletePartnerMediaUrls(
    collectPartnerChangeRequestRequestedMediaUrls(rejected),
  ).catch(() => undefined);
  return rejected;
}

export const partnerChangeRequestRepository: PartnerChangeRequestRepository = {
  async getRequestContext(companyIds: string[], partnerId: string) {
    if (isPartnerPortalMock) {
      return getMockPartnerChangeRequestContext(companyIds, partnerId);
    }
    return getSupabaseRequestContext(companyIds, partnerId);
  },

  async listPendingRequests(companyIds?: string[]) {
    if (isPartnerPortalMock) {
      return listMockPartnerChangeRequests(companyIds);
    }
    return getSupabasePendingRequests(companyIds);
  },

  async createRequest(input: PartnerChangeRequestCreateInput) {
    if (isPartnerPortalMock) {
      return createMockPartnerChangeRequest(input);
    }
    return createSupabaseRequest(input);
  },

  async cancelRequest(input: PartnerChangeRequestCancelInput) {
    if (isPartnerPortalMock) {
      return cancelMockPartnerChangeRequest(input);
    }
    return cancelSupabaseRequest(input);
  },

  async approveRequest(input: PartnerChangeRequestReviewInput) {
    if (isPartnerPortalMock) {
      return approveMockPartnerChangeRequest(input);
    }
    return approveSupabaseRequest(input);
  },

  async rejectRequest(input: PartnerChangeRequestReviewInput) {
    if (isPartnerPortalMock) {
      return rejectMockPartnerChangeRequest(input);
    }
    return rejectSupabaseRequest(input);
  },
};

export async function getPartnerChangeRequestContext(
  companyIds: string[],
  partnerId: string,
) {
  return partnerChangeRequestRepository.getRequestContext(companyIds, partnerId);
}

export async function listPartnerChangeRequests(companyIds?: string[]) {
  return partnerChangeRequestRepository.listPendingRequests(companyIds);
}

export async function createPartnerChangeRequest(
  input: PartnerChangeRequestCreateInput,
) {
  return partnerChangeRequestRepository.createRequest(input);
}

export async function cancelPartnerChangeRequest(
  input: PartnerChangeRequestCancelInput,
) {
  return partnerChangeRequestRepository.cancelRequest(input);
}

export async function approvePartnerChangeRequest(
  input: PartnerChangeRequestReviewInput,
) {
  return partnerChangeRequestRepository.approveRequest(input);
}

export async function rejectPartnerChangeRequest(
  input: PartnerChangeRequestReviewInput,
) {
  return partnerChangeRequestRepository.rejectRequest(input);
}

export { PartnerChangeRequestError } from "./partner-change-request-errors.ts";
export {
  getPartnerChangeRequestErrorMessage,
  getPartnerChangeRequestErrorStatus,
} from "./partner-change-request-errors.ts";
