/**
 * Single source for the `partners` insert row used by every admin creation
 * path (direct admin create and registration conversion). Both paths must
 * supply every column explicitly so a new column cannot silently diverge.
 */
export const PARTNER_INSERT_COLUMNS = [
  "id",
  "company_id",
  "brand_profile_id",
  "name",
  "category_id",
  "location",
  "detail_description",
  "campus_slugs",
  "managed_campus_slugs",
  "map_url",
  "benefit_action_type",
  "benefit_action_link",
  "benefit_verification_pin_hash",
  "benefit_verification_pin_salt",
  "reservation_link",
  "inquiry_link",
  "period_start",
  "period_end",
  "conditions",
  "benefits",
  "applies_to",
  "thumbnail",
  "images",
  "tags",
  "visibility",
  "benefit_visibility",
  "branch_scope_type",
  "branch_scope_note",
] as const;

export type PartnerInsertColumn = (typeof PARTNER_INSERT_COLUMNS)[number];

export type PartnerInsertRowInput = {
  id: string;
  companyId: string | null;
  brandProfileId: string | null;
  name: string;
  categoryId: string;
  location: string;
  detailDescription: string | null;
  campusSlugs: string[];
  managedCampusSlugs: string[];
  mapUrl: string | null;
  benefitActionType: string;
  benefitActionLink: string | null;
  benefitVerificationPinHash: string | null;
  benefitVerificationPinSalt: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  conditions: string[];
  benefits: string[];
  appliesTo: string[];
  thumbnail: string | null;
  images: string[];
  tags: string[];
  visibility: string;
  benefitVisibility: string;
  branchScopeType: string;
  branchScopeNote: string | null;
};

export type PartnerInsertRow = {
  id: string;
  company_id: string | null;
  brand_profile_id: string | null;
  name: string;
  category_id: string;
  location: string;
  detail_description: string | null;
  campus_slugs: string[];
  managed_campus_slugs: string[];
  map_url: string | null;
  benefit_action_type: string;
  benefit_action_link: string | null;
  benefit_verification_pin_hash: string | null;
  benefit_verification_pin_salt: string | null;
  reservation_link: string | null;
  inquiry_link: string | null;
  period_start: string | null;
  period_end: string | null;
  conditions: string[];
  benefits: string[];
  applies_to: string[];
  thumbnail: string | null;
  images: string[];
  tags: string[];
  visibility: string;
  benefit_visibility: string;
  branch_scope_type: string;
  branch_scope_note: string | null;
};

export function buildPartnerInsertRow(
  input: PartnerInsertRowInput,
): PartnerInsertRow {
  return {
    id: input.id,
    company_id: input.companyId,
    brand_profile_id: input.brandProfileId,
    name: input.name,
    category_id: input.categoryId,
    location: input.location,
    detail_description: input.detailDescription,
    campus_slugs: input.campusSlugs,
    managed_campus_slugs: input.managedCampusSlugs,
    map_url: input.mapUrl,
    benefit_action_type: input.benefitActionType,
    benefit_action_link: input.benefitActionLink,
    benefit_verification_pin_hash: input.benefitVerificationPinHash,
    benefit_verification_pin_salt: input.benefitVerificationPinSalt,
    reservation_link: input.reservationLink,
    inquiry_link: input.inquiryLink,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    conditions: input.conditions,
    benefits: input.benefits,
    applies_to: input.appliesTo,
    thumbnail: input.thumbnail,
    images: input.images,
    tags: input.tags,
    visibility: input.visibility,
    benefit_visibility: input.benefitVisibility,
    branch_scope_type: input.branchScopeType,
    branch_scope_note: input.branchScopeNote,
  };
}
