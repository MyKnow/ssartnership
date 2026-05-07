import type { PartnerAudienceKey } from "../partner-audience.ts";
import type { CampusSlug } from "../campuses.ts";
import type {
  PartnerBenefitActionType,
  PartnerVisibility,
} from "../types.ts";
import { PartnerChangeRequestError } from "../partner-change-request-errors.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

export function wrapPartnerChangeRequestDbError(
  error: { message?: string | null } | null | undefined,
  message = "변경 요청 정보를 처리하지 못했습니다.",
) {
  return new PartnerChangeRequestError(
    "invalid_request",
    error?.message?.trim() || message,
  );
}

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
  currentPartnerName: string;
  currentPartnerLocation: string;
  currentMapUrl: string | null;
  currentCampusSlugs: CampusSlug[];
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
  requestedPartnerName: string;
  requestedPartnerLocation: string;
  requestedMapUrl: string | null;
  requestedCampusSlugs: CampusSlug[];
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
  partnerCreatedAt: string;
  categoryLabel: string;
  categoryColor: string | null;
  visibility: PartnerVisibility;
  periodStart: string | null;
  periodEnd: string | null;
  thumbnail: string | null;
  images: string[];
  tags: string[];
  mapUrl: string | null;
  benefitActionType: PartnerBenefitActionType;
  benefitActionLink: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  currentConditions: string[];
  currentBenefits: string[];
  currentAppliesTo: PartnerAudienceKey[];
  currentTags: string[];
  currentCampusSlugs: CampusSlug[];
  currentThumbnail: string | null;
  currentImages: string[];
  currentReservationLink: string | null;
  currentInquiryLink: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pendingRequest: PartnerChangeRequestSummary | null;
  requestHistory: PartnerChangeRequestSummary[];
};

export type PartnerChangeRequestCreateInput = {
  companyIds: string[];
  partnerId: string;
  requestedByAccountId: string;
  requestedByLoginId: string;
  requestedByDisplayName: string;
  requestedPartnerName: string;
  requestedPartnerLocation: string;
  requestedMapUrl: string | null;
  requestedCampusSlugs: CampusSlug[];
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

export type PartnerImmediateUpdateInput = {
  companyIds: string[];
  partnerId: string;
  thumbnail: string | null;
  images: string[];
  tags: string[];
  reservationLink: string | null;
  benefitActionType?: PartnerBenefitActionType;
  benefitActionLink?: string | null;
  inquiryLink: string | null;
};

export type PartnerImmediateUpdateResult = {
  partnerId: string;
  companyId: string;
  previousMediaUrls: string[];
  currentMediaUrls: string[];
};

export interface PartnerChangeRequestRepository {
  getRequestContext(
    companyIds: string[],
    partnerId: string,
    accountId?: string,
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

export type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
};

export type PartnerCategoryRow = {
  key?: string | null;
  label?: string | null;
  color?: string | null;
};

export type PartnerRow = {
  id: string;
  company_id?: string | null;
  name: string;
  created_at: string;
  location: string;
  thumbnail?: string | null;
  map_url?: string | null;
  benefit_action_type?: string | null;
  benefit_action_link?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  applies_to?: string[] | null;
  campus_slugs?: string[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility?: string | null;
  categories?: PartnerCategoryRow | PartnerCategoryRow[] | null;
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
};

export type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
};

export type PartnerChangeRequestRow = {
  id: string;
  company_id: string;
  partner_id: string;
  status: PartnerChangeRequestStatus;
  current_partner_name?: string | null;
  current_partner_location?: string | null;
  current_map_url?: string | null;
  current_campus_slugs?: string[] | null;
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
  requested_partner_name?: string | null;
  requested_partner_location?: string | null;
  requested_map_url?: string | null;
  requested_campus_slugs?: string[] | null;
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
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
  partner?:
    | (PartnerRow & { categories?: PartnerCategoryRow | PartnerCategoryRow[] | null })
    | (PartnerRow & { categories?: PartnerCategoryRow | PartnerCategoryRow[] | null })[]
    | null;
  requested_by?: PartnerAccountRow | PartnerAccountRow[] | null;
};

export const REQUEST_SELECT =
  "id,company_id,partner_id,status,current_partner_name,current_partner_location,current_map_url,current_campus_slugs,current_conditions,current_benefits,current_applies_to,current_tags,current_thumbnail,current_images,current_reservation_link,current_inquiry_link,current_period_start,current_period_end,requested_partner_name,requested_partner_location,requested_map_url,requested_campus_slugs,requested_conditions,requested_benefits,requested_applies_to,requested_tags,requested_thumbnail,requested_images,requested_reservation_link,requested_inquiry_link,requested_period_start,requested_period_end,requested_by_account_id,reviewed_by_admin_id,reviewed_at,cancelled_by_account_id,cancelled_at,created_at,updated_at,company:partner_companies(id,name,slug),partner:partners(id,name,location,campus_slugs,map_url,conditions,benefits,applies_to,thumbnail,images,tags,reservation_link,inquiry_link,period_start,period_end,categories(label),company:partner_companies(id,name,slug)),requested_by:partner_accounts!partner_change_requests_requested_by_account_id_fkey(id,login_id,display_name,email)";

export type PartnerChangeRequestSupabaseClient = ReturnType<
  typeof getSupabaseAdminClient
>;

export function normalizeCompanyIds(companyIds: string[]) {
  return [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
}

export function normalizeSupabaseCompanyIds(companyIds: string[]) {
  return [
    ...new Set(
      companyIds
        .map((id) => id.trim())
        .filter((id): id is string => Boolean(id) && isUuid(id)),
    ),
  ];
}
