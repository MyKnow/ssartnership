import { normalizePartnerVisibility } from "../partner-visibility.ts";
import { normalizePartnerBenefitActionType } from "../partner-benefit-action.ts";
import { resolvePartnerCampusSlugs } from "../campuses.ts";
import { sanitizePartnerLinkValue } from "../validation.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import {
  extractCategoryColor,
  extractCategoryLabel,
  fetchPendingRequestSummary,
  toSummary,
} from "./summary.ts";
import {
  normalizeAudience,
  normalizeHttpUrlList,
  normalizeOptionalText,
  normalizeRelation,
  normalizeTextList,
} from "./normalizers.ts";
import {
  normalizeSupabaseCompanyIds,
  REQUEST_SELECT,
  type PartnerChangeRequestContext,
  type PartnerChangeRequestRow,
  type PartnerRow,
  wrapPartnerChangeRequestDbError,
} from "./shared.ts";

export async function getSupabaseRequestContext(
  companyIds: string[],
  partnerId: string,
): Promise<PartnerChangeRequestContext | null> {
  const uniqueCompanyIds = normalizeSupabaseCompanyIds(companyIds);
  if (uniqueCompanyIds.length === 0) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: partner, error } = await supabase
    .from("partners")
    .select(
      "id,company_id,created_at,name,location,campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,categories(key,label,color),company:partner_companies(id,name,slug)",
    )
    .eq("id", partnerId)
    .maybeSingle();

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 정보를 불러오지 못했습니다.",
    );
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
    partnerCreatedAt: row.created_at,
    categoryLabel: extractCategoryLabel(row.categories ?? null),
    categoryColor: extractCategoryColor(row.categories ?? null),
    visibility: normalizePartnerVisibility(row.visibility),
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    thumbnail: row.thumbnail ?? null,
    images: normalizeHttpUrlList(row.images),
    tags: normalizeTextList(row.tags),
    mapUrl: row.map_url ?? null,
    benefitActionType: normalizePartnerBenefitActionType(
      row.benefit_action_type,
      row.benefit_action_link || row.reservation_link ? "external_link" : "none",
    ),
    benefitActionLink: sanitizePartnerLinkValue(
      row.benefit_action_link ?? row.reservation_link ?? undefined,
    ),
    reservationLink: sanitizePartnerLinkValue(row.reservation_link ?? undefined),
    inquiryLink: sanitizePartnerLinkValue(row.inquiry_link ?? undefined),
    currentConditions: normalizeTextList(row.conditions),
    currentBenefits: normalizeTextList(row.benefits),
    currentAppliesTo: normalizeAudience(row.applies_to),
    currentCampusSlugs: resolvePartnerCampusSlugs({
      location: row.location,
      campusSlugs: row.campus_slugs ?? [],
    }),
    currentTags: normalizeTextList(row.tags),
    currentThumbnail: row.thumbnail ?? null,
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

export async function getSupabasePendingRequests(companyIds?: string[]) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const uniqueCompanyIds = normalizeSupabaseCompanyIds(companyIds ?? []);
  if (uniqueCompanyIds.length > 0) {
    query = query.in("company_id", uniqueCompanyIds);
  }

  const { data, error } = await query;

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 정보를 불러오지 못했습니다.",
    );
  }

  return (data ?? []).map((row) => toSummary(row as PartnerChangeRequestRow));
}
