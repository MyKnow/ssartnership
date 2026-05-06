import { resolveFormCampusSlugs } from "../campuses.ts";
import { sanitizeHttpUrl } from "../validation.ts";
import {
  normalizeAudience,
  normalizeHttpUrlList,
  normalizeOptionalText,
  normalizeRelation,
  normalizeRequiredText,
  normalizeTextList,
} from "./normalizers.ts";
import type {
  PartnerChangeRequestRow,
  PartnerChangeRequestSummary,
  PartnerChangeRequestSupabaseClient,
  PartnerRow,
} from "./shared.ts";
import { REQUEST_SELECT as REQUEST_SELECT_VALUE, wrapPartnerChangeRequestDbError } from "./shared.ts";

export function extractCategoryLabel(categories: PartnerRow["categories"]) {
  const category = normalizeRelation(categories);
  return category?.label ?? "브랜드";
}

export function extractCategoryColor(categories: PartnerRow["categories"]) {
  const category = normalizeRelation(categories);
  return category?.color ?? null;
}

export function toSummary(row: PartnerChangeRequestRow): PartnerChangeRequestSummary {
  const company = normalizeRelation(row.company);
  const partner = normalizeRelation(row.partner);
  const requestedBy = normalizeRelation(row.requested_by);
  const currentPartnerName = normalizeRequiredText(
    row.current_partner_name || partner?.name || "",
  );
  const currentPartnerLocation = normalizeRequiredText(
    row.current_partner_location || partner?.location || "",
  );
  const currentMapUrl = normalizeOptionalText(
    sanitizeHttpUrl(row.current_map_url ?? partner?.map_url ?? undefined),
  );
  const currentCampusSlugs = resolveFormCampusSlugs(
    row.current_campus_slugs ?? partner?.campus_slugs ?? [],
    currentPartnerLocation,
  );
  const requestedPartnerName = normalizeRequiredText(
    row.requested_partner_name || currentPartnerName || partner?.name || "",
  );
  const requestedPartnerLocation = normalizeRequiredText(
    row.requested_partner_location ||
      currentPartnerLocation ||
      partner?.location ||
      "",
  );
  const requestedMapUrl = normalizeOptionalText(
    sanitizeHttpUrl(row.requested_map_url ?? currentMapUrl ?? undefined),
  );
  const requestedCampusSlugs = resolveFormCampusSlugs(
    row.requested_campus_slugs ?? currentCampusSlugs,
    requestedPartnerLocation,
  );

  return {
    id: row.id,
    companyId: row.company_id,
    companyName: company?.name ?? "미지정",
    companySlug: company?.slug ?? "",
    partnerId: row.partner_id,
    partnerName: currentPartnerName || "미지정",
    partnerLocation: currentPartnerLocation || "",
    currentPartnerName,
    currentPartnerLocation,
    currentMapUrl,
    currentCampusSlugs,
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
    requestedPartnerName,
    requestedPartnerLocation,
    requestedMapUrl,
    requestedCampusSlugs,
    reviewedByAdminId: row.reviewed_by_admin_id ?? null,
    reviewedAt: row.reviewed_at ?? null,
    cancelledByAccountId: row.cancelled_by_account_id ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchRequestSummary(
  supabase: PartnerChangeRequestSupabaseClient,
  requestId: string,
) {
  const { data, error } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT_VALUE)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 정보를 불러오지 못했습니다.",
    );
  }

  return data ? toSummary(data as PartnerChangeRequestRow) : null;
}

export async function fetchPendingRequestSummary(
  supabase: PartnerChangeRequestSupabaseClient,
  partnerId: string,
) {
  const { data, error } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT_VALUE)
    .eq("partner_id", partnerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 정보를 불러오지 못했습니다.",
    );
  }

  return data ? toSummary(data as PartnerChangeRequestRow) : null;
}
