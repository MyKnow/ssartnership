import type { Category, CategoryKey, Partner } from "../../lib/types.ts";
import { getPartnerAudienceLabel, type PartnerAudienceFilter } from "../../lib/partner-audience.ts";
import {
  getPartnerLockKind,
  getPartnerVisibilityState,
} from "../../lib/partner-visibility.ts";
import { compareEndDate } from "../../lib/partner-utils.ts";

export type HomePartnerSortOption = "recent" | "endingSoon";

const LOCK_ORDER = {
  confidential: 0,
  private: 1,
} as const;

export type HomePartnerViewModel = Partner & {
  _index: number;
  _visibilityState: "public" | "confidential" | "private" | "expired";
  _lockKind: "confidential" | "private" | null;
  _isActive: boolean;
  _isExpired: boolean;
  _search: string;
};

export function createHomeCategoryMap(categories: Category[]) {
  return new Map(
    categories.map((category) => [
      category.key,
      { label: category.label, color: category.color },
    ]),
  );
}

export function normalizeHomePartners(
  partners: Partner[],
  viewerAuthenticated: boolean,
): HomePartnerViewModel[] {
  return partners.map((partner, index) => {
    const visibilityState = getPartnerVisibilityState(
      partner.visibility,
      partner.period.start,
      partner.period.end,
    );

    const lockKind =
      visibilityState === "expired"
        ? null
        : getPartnerLockKind(partner.visibility, viewerAuthenticated);

    return {
      ...partner,
      _index: index,
      _visibilityState: visibilityState,
      _lockKind: lockKind,
      _isActive: visibilityState !== "expired",
      _isExpired: visibilityState === "expired",
      _search: [
        partner.name,
        partner.location,
        partner.reservationLink ?? "",
        partner.inquiryLink ?? "",
        partner.conditions.join(" "),
        partner.benefits.join(" "),
        partner.appliesTo.map((item) => getPartnerAudienceLabel(item)).join(" "),
        (partner.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}

export function filterHomePartners({
  partners,
  activeCategory,
  appliesToFilter,
  searchValue,
  sortValue,
}: {
  partners: HomePartnerViewModel[];
  activeCategory: CategoryKey | "all";
  appliesToFilter: PartnerAudienceFilter;
  searchValue: string;
  sortValue: HomePartnerSortOption;
}) {
  const query = searchValue.trim().toLowerCase();
  const categoryFiltered =
    activeCategory === "all"
      ? partners
      : partners.filter((partner) => partner.category === activeCategory);

  const appliesFiltered =
    appliesToFilter === "all"
      ? categoryFiltered
      : categoryFiltered.filter((partner) =>
          partner.appliesTo.includes(appliesToFilter),
        );

  const activeFiltered = appliesFiltered.filter((partner) => !partner._isExpired);
  const visibleFiltered = activeFiltered.filter((partner) => !partner._lockKind);
  const lockedFiltered = activeFiltered.filter((partner) => partner._lockKind);
  const searchFiltered = query
    ? visibleFiltered.filter((partner) => partner._search.includes(query))
    : visibleFiltered;

  const sortPartners = (items: typeof searchFiltered) =>
    [...items].sort((a, b) => {
      if (a._lockKind !== b._lockKind) {
        return (
          LOCK_ORDER[a._lockKind ?? "confidential"] -
          LOCK_ORDER[b._lockKind ?? "confidential"]
        );
      }
      if (a._isActive !== b._isActive) {
        return a._isActive ? -1 : 1;
      }
      if (sortValue === "endingSoon") {
        const compare = compareEndDate(a.period.end, b.period.end);
        if (compare !== 0) {
          return compare;
        }
      }
      return a._index - b._index;
    });

  const visible = sortPartners(searchFiltered);
  const locked = sortPartners(lockedFiltered);

  return {
    visible,
    locked,
    display: [...visible, ...locked],
  };
}
