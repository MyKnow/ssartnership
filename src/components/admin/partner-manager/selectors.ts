import { compareEndDate, isWithinPeriod } from "../../../lib/partner-utils.ts";
import {
  getPartnerAudienceLabel,
  normalizePartnerAudience,
} from "../../../lib/partner-audience.ts";
import type { PartnerSortOption } from "../../PartnerFilters";
import {
  calculatePartnerPopularityScore,
} from "@/lib/partner-popularity";
import type {
  ActiveCategoryFilter,
  AdminCategory,
  AdminCompany,
  AdminPartner,
  VisibilityFilter,
} from "./types.ts";

export function createAdminPartnerCategoryOptions(categories: AdminCategory[]) {
  return categories.map((category) => ({
    id: category.id,
    label: category.label,
    key: category.key,
    description: category.description ?? "",
    color: category.color ?? null,
  }));
}

export function createAdminPartnerCompanyOptions(companies: AdminCompany[]) {
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
  }));
}

export function buildCategoryKeyById(categories: AdminCategory[]) {
  return new Map(categories.map((category) => [category.id, category.key]));
}

export function filterAndSortAdminPartners({
  partners,
  categoryKeyById,
  activeCategory,
  visibilityFilter,
  searchValue,
  sortValue,
}: {
  partners: AdminPartner[];
  categoryKeyById: Map<string, string>;
  activeCategory: ActiveCategoryFilter;
  visibilityFilter: VisibilityFilter;
  searchValue: string;
  sortValue: PartnerSortOption;
}) {
  const query = searchValue.trim().toLowerCase();

  const normalized = partners.map((partner, index) => {
    const categoryKey = categoryKeyById.get(partner.category_id) ?? "unknown";
    const conditions = partner.conditions ?? [];
    const benefits = partner.benefits ?? [];
    const appliesTo = normalizePartnerAudience(partner.applies_to);
    const tags = partner.tags ?? [];

    return {
      ...partner,
      _index: index,
      _categoryKey: categoryKey,
      _isActive: isWithinPeriod(partner.period_start, partner.period_end),
      _popularityScore: calculatePartnerPopularityScore({
        favoriteCount: partner.metrics?.favoriteCount,
        detailViews: partner.metrics?.detailViews,
        reviewCount: partner.metrics?.reviewCount,
      }),
      _search: [
        partner.name,
        partner.company?.name ?? "",
        partner.location,
        partner.reservation_link ?? "",
        partner.inquiry_link ?? "",
        conditions.join(" "),
        partner.reservation_link,
        partner.inquiry_link,
        benefits.join(" "),
        appliesTo.map((item) => getPartnerAudienceLabel(item)).join(" "),
        tags.join(" "),
      ]
        .join(" ")
        .toLowerCase(),
    };
  });

  const categoryFiltered =
    activeCategory === "all"
      ? normalized
      : normalized.filter((partner) => partner._categoryKey === activeCategory);

  const visibilityFiltered =
    visibilityFilter === "all"
      ? categoryFiltered
      : categoryFiltered.filter((partner) => partner.visibility === visibilityFilter);

  const searchFiltered = query
    ? visibilityFiltered.filter((partner) => partner._search.includes(query))
    : visibilityFiltered;

  return [...searchFiltered].sort((a, b) => {
    if (a._isActive !== b._isActive) {
      return a._isActive ? -1 : 1;
    }
    if (sortValue === "popular") {
      const compare = b._popularityScore - a._popularityScore;
      if (compare !== 0) {
        return compare;
      }
    }
    if (sortValue === "endingSoon") {
      const compare = compareEndDate(a.period_end, b.period_end);
      if (compare !== 0) {
        return compare;
      }
    }
    return a._index - b._index;
  });
}
