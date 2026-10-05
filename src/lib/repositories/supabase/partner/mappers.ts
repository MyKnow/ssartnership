import type { Category, Partner } from "@/lib/types";
import {
  buildLegacyPartnerBenefitItems,
  partnerBenefitItemsToTitles,
} from "@/lib/partner-benefit-items";
import { normalizePartnerAudience } from "@/lib/partner-audience";
import { normalizeCampusSlugs } from "@/lib/campuses";
import { normalizePartnerBenefitActionType } from "@/lib/partner-benefit-action";
import { toLeanPublicDirectoryPartner } from "@/lib/public-partner-directory";
import type {
  PartnerViewContext,
  PublicPartnerSeoEntry,
} from "@/lib/repositories/partner-repository";
import {
  canViewPartnerDetails,
  normalizePartnerVisibility,
} from "@/lib/partner-visibility";
import {
  maskPartnerBenefitsForAccess,
  normalizePartnerBenefitVisibility,
} from "@/lib/partner-benefit-visibility";
import type {
  CategoryRow,
  PartnerCategoryRelation,
  PartnerRow,
  PublicPartnerSeoRow,
} from "./rows";

/**
 * Pure row → domain mappers for the public partner catalog.
 *
 * The Supabase repository owns queries, cache wrappers and preview-token
 * checks; everything here must stay deterministic and free of server-only
 * imports so it can be covered by import-based unit tests.
 */

export const DEFAULT_PARTNER_CATEGORY_KEY = "health";

function normalizeDate(value: string | null | undefined) {
  return value ?? "미정";
}

export function extractCategoryKey(categories: PartnerCategoryRelation | undefined) {
  if (!categories) {
    return undefined;
  }
  if (Array.isArray(categories)) {
    return categories[0]?.key ?? undefined;
  }
  if (typeof categories === "object") {
    return categories.key ?? undefined;
  }
  return undefined;
}

export function resolvePartnerCategoryKey(row: Pick<PartnerRow, "categories">) {
  return extractCategoryKey(row.categories) ?? DEFAULT_PARTNER_CATEGORY_KEY;
}

export function getPartnerBenefitItems(row: PartnerRow) {
  return row.partner_benefits?.length
    ? row.partner_benefits
        .slice()
        .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
        .map((benefit) => ({
          id: benefit.id,
          title: benefit.title,
          maxApplyCount: benefit.max_apply_count,
          displayOrder: benefit.display_order ?? undefined,
        }))
    : buildLegacyPartnerBenefitItems(row.benefits ?? [], row.id);
}

export function toVisiblePartner(row: PartnerRow, categoryKey: string): Partner {
  const galleryImages = row.images ?? [];
  const thumbnail = row.thumbnail ?? row.images?.[0] ?? null;
  const benefitItems = getPartnerBenefitItems(row);
  return {
    id: row.id,
    name: row.name,
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    benefitVisibility: normalizePartnerBenefitVisibility(row.benefit_visibility),
    createdAt: row.created_at,
    location: row.location,
    detailDescription: row.detail_description ?? null,
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    thumbnail,
    mapUrl: row.map_url ?? undefined,
    benefitActionType: normalizePartnerBenefitActionType(
      row.benefit_action_type,
      row.benefit_action_link || row.reservation_link ? "external_link" : "none",
    ),
    benefitActionLink: row.benefit_action_link ?? undefined,
    benefitItems,
    reservationLink: row.reservation_link ?? undefined,
    inquiryLink: row.inquiry_link ?? undefined,
    period: {
      start: normalizeDate(row.period_start),
      end: normalizeDate(row.period_end),
    },
    conditions: row.conditions ?? [],
    benefits: partnerBenefitItemsToTitles(benefitItems),
    appliesTo: normalizePartnerAudience(row.applies_to),
    images: galleryImages,
    tags: row.tags ?? [],
    branchScopeType: row.branch_scope_type ?? "single_location",
    branchScopeNote: row.branch_scope_note ?? null,
  };
}

export function toLockedPartner(row: PartnerRow, categoryKey: string): Partner {
  return {
    id: row.id,
    name: "",
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    benefitVisibility: normalizePartnerBenefitVisibility(row.benefit_visibility),
    createdAt: row.created_at,
    location: "",
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    period: {
      start: "",
      end: "",
    },
    conditions: [],
    benefits: [],
    appliesTo: normalizePartnerAudience(row.applies_to),
    thumbnail: null,
    images: [],
    tags: [],
  };
}

export function toVisiblePublicDirectorySummaryPartner(
  row: PartnerRow,
  categoryKey: string,
): Partner {
  const appliesTo = normalizePartnerAudience(row.applies_to);
  const benefitItems = getPartnerBenefitItems(row);
  return {
    id: row.id,
    name: row.name,
    category: categoryKey,
    visibility: normalizePartnerVisibility(row.visibility),
    benefitVisibility: normalizePartnerBenefitVisibility(row.benefit_visibility),
    createdAt: row.created_at,
    location: row.location,
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    thumbnail: row.thumbnail ?? null,
    mapUrl: row.map_url ?? undefined,
    benefitActionType: normalizePartnerBenefitActionType(
      row.benefit_action_type,
      row.benefit_action_link || row.reservation_link ? "external_link" : "none",
    ),
    benefitActionLink: row.benefit_action_link ?? undefined,
    reservationLink: row.reservation_link ?? undefined,
    inquiryLink: row.inquiry_link ?? undefined,
    period: {
      start: normalizeDate(row.period_start),
      end: normalizeDate(row.period_end),
    },
    conditions: row.conditions ?? [],
    benefits: partnerBenefitItemsToTitles(benefitItems),
    benefitItems,
    appliesTo,
    images: [],
    tags: row.tags ?? [],
    branchScopeType: row.branch_scope_type ?? "single_location",
  };
}

export function mapPartnerForList(
  row: PartnerRow,
  context: PartnerViewContext,
): Partner {
  const categoryKey = resolvePartnerCategoryKey(row);
  const visibility = normalizePartnerVisibility(row.visibility);
  if (canViewPartnerDetails(visibility, context.authenticated)) {
    return maskPartnerBenefitsForAccess(toVisiblePartner(row, categoryKey), context);
  }
  return toLockedPartner(row, categoryKey);
}

export function mapPartnerForPublicDirectory(
  row: PartnerRow,
  context: PartnerViewContext,
): Partner {
  const categoryKey = resolvePartnerCategoryKey(row);
  const visibility = normalizePartnerVisibility(row.visibility);
  if (canViewPartnerDetails(visibility, context.authenticated)) {
    const summaryPartner = toVisiblePublicDirectorySummaryPartner(row, categoryKey);
    const maskedPartner = maskPartnerBenefitsForAccess(summaryPartner, context);
    return toLeanPublicDirectoryPartner(maskedPartner);
  }
  return toLockedPartner(row, categoryKey);
}

/**
 * Detail visibility for a partner fetched without a preview token. Preview
 * links bypass this gate after the token itself has been validated.
 */
export function canViewPartnerDetailRow(
  row: Pick<PartnerRow, "visibility" | "period_start" | "period_end">,
  context: Pick<PartnerViewContext, "authenticated">,
) {
  const visibility = normalizePartnerVisibility(row.visibility);
  if (visibility === "private") {
    return false;
  }
  if (visibility === "confidential" && !context.authenticated) {
    return false;
  }
  return canViewPartnerDetails(visibility, context.authenticated, {
    start: row.period_start,
    end: row.period_end,
  });
}

export function mapPartnerForDetail(
  row: PartnerRow,
  context: PartnerViewContext,
): Partner {
  return maskPartnerBenefitsForAccess(
    toVisiblePartner(row, resolvePartnerCategoryKey(row)),
    context,
  );
}

export function mapPartnerRaw(row: PartnerRow): Partner {
  return toVisiblePartner(row, resolvePartnerCategoryKey(row));
}

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    key: row.key ?? "",
    label: row.label ?? "",
    description: row.description ?? "",
    color: row.color ?? undefined,
  };
}

export function mapPublicPartnerSeoEntry(
  row: PublicPartnerSeoRow,
): PublicPartnerSeoEntry {
  const category = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;

  return {
    id: row.id,
    name: row.name,
    categoryLabel: category?.label ?? "제휴",
    location: row.location,
    campusSlugs: normalizeCampusSlugs(row.campus_slugs ?? []),
    createdAt: row.created_at ?? null,
    period: {
      start: row.period_start,
      end: row.period_end,
    },
  };
}
