"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import PartnerFilters, {
  PartnerSortOption,
} from "@/components/PartnerFilters";
import PartnerCardView from "@/components/PartnerCardView";
import SectionHeading from "@/components/ui/SectionHeading";
import EmptyState from "@/components/ui/EmptyState";
import { HOME_COPY } from "@/lib/content";
import { compareEndDate, isWithinPeriod } from "@/lib/partner-utils";
import { trackProductEvent } from "@/lib/product-events";
import { useToast } from "@/components/ui/Toast";
import { getPartnerLockKind } from "@/lib/partner-visibility";
import {
  getPartnerAudienceLabel,
  type PartnerAudienceFilter,
} from "@/lib/partner-audience";

const APPLIES_TO_FILTER_STORAGE_KEY = "home:partner-applies-to-filter";

const LOCK_ORDER = {
  confidential: 0,
  private: 1,
} as const;

export default function HomeView({
  categories,
  partners,
  viewerAuthenticated,
}: {
  categories: Category[];
  partners: Partner[];
  viewerAuthenticated: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">(
    "all",
  );
  const [appliesToFilter, setAppliesToFilter] = useState<PartnerAudienceFilter>(
    () => {
      if (typeof window === "undefined") {
        return "all";
      }
      try {
        const saved = window.localStorage.getItem(
          APPLIES_TO_FILTER_STORAGE_KEY,
        );
        if (saved === "all" || saved === "staff" || saved === "student" || saved === "graduate") {
          return saved;
        }
      } catch {
        return "all";
      }
      return "all";
    },
  );
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<PartnerSortOption>("recent");
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchTimeoutRef = useRef<number | null>(null);
  const lastLoggedSearchRef = useRef("");
  const { notify } = useToast();

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.key,
        { label: category.label, color: category.color },
      ]),
    );
  }, [categories]);

  const normalizedPartners = useMemo(
    () =>
      partners.map((partner, index) => ({
        ...partner,
        _index: index,
        _lockKind: getPartnerLockKind(partner.visibility, viewerAuthenticated),
        _isActive: isWithinPeriod(partner.period.start, partner.period.end),
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
      })),
    [partners, viewerAuthenticated],
  );

  const filteredPartners = useMemo(() => {
    const query = deferredSearchValue.trim().toLowerCase();
    const categoryFiltered =
      activeCategory === "all"
        ? normalizedPartners
        : normalizedPartners.filter((partner) => partner.category === activeCategory);

    const appliesFiltered =
      appliesToFilter === "all"
        ? categoryFiltered
        : categoryFiltered.filter((partner) =>
            partner.appliesTo.includes(appliesToFilter),
          );

    const visibleFiltered = appliesFiltered.filter((partner) => !partner._lockKind);
    const lockedFiltered = appliesFiltered.filter((partner) => partner._lockKind);

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

    return {
      visible: sortPartners(searchFiltered),
      locked: sortPartners(lockedFiltered),
    };
  }, [activeCategory, appliesToFilter, deferredSearchValue, normalizedPartners, sortValue]);

  const displayPartners = useMemo(
    () => [...filteredPartners.visible, ...filteredPartners.locked],
    [filteredPartners.locked, filteredPartners.visible],
  );

  const visibleResultCount = filteredPartners.visible.length;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(APPLIES_TO_FILTER_STORAGE_KEY, appliesToFilter);
    } catch {
      // Ignore storage failures.
    }
  }, [appliesToFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flag = sessionStorage.getItem("suggest:submitted");
    if (flag) {
      sessionStorage.removeItem("suggest:submitted");
      notify("정상적으로 제출되었습니다.");
    }
  }, [notify]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    const query = deferredSearchValue.trim();
    if (!query) {
      lastLoggedSearchRef.current = "";
      return;
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      const dedupeKey = `${activeCategory}:${appliesToFilter}:${sortValue}:${query}`;
      if (lastLoggedSearchRef.current === dedupeKey) {
        return;
      }
      lastLoggedSearchRef.current = dedupeKey;
      trackProductEvent({
        eventName: "search_execute",
        targetType: "partner_search",
        properties: {
          query,
          categoryKey: activeCategory,
          appliesToFilter,
          sortValue,
          resultCount: visibleResultCount,
        },
      });
    }, 450);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [activeCategory, appliesToFilter, deferredSearchValue, sortValue, visibleResultCount]);

  const handleCategoryChange = (nextCategory: CategoryKey | "all") => {
    startTransition(() => {
      setActiveCategory(nextCategory);
    });
    trackProductEvent({
      eventName: "category_filter_change",
      targetType: "category",
      targetId: nextCategory === "all" ? null : nextCategory,
      properties: {
        categoryKey: nextCategory,
      },
    });
  };

  const handleSortChange = (nextSort: PartnerSortOption) => {
    startTransition(() => {
      setSortValue(nextSort);
    });
    trackProductEvent({
      eventName: "sort_change",
      targetType: "partner_sort",
      targetId: nextSort,
      properties: {
        sortValue: nextSort,
      },
    });
  };

  const handleSearchChange = (nextValue: string) => {
    setSearchValue(nextValue);
  };

  return (
    <>
      <section className="mt-10 flex flex-col gap-6" data-nosnippet>
        <SectionHeading
          title={HOME_COPY.categoryTitle}
          description={HOME_COPY.categoryDescription}
        />
        <PartnerFilters
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          appliesToFilter={appliesToFilter}
          onAppliesToFilterChange={setAppliesToFilter}
          sortValue={sortValue}
          onSortChange={handleSortChange}
        />
      </section>

      <section className="mt-10">
        {displayPartners.length === 0 ? (
          <EmptyState
            title={
              partners.length === 0
                ? HOME_COPY.emptyTitle
                : HOME_COPY.noResultsTitle
            }
            description={
              partners.length === 0
                ? HOME_COPY.emptyDescription
                : HOME_COPY.noResultsDescription
            }
          />
        ) : (
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-6">
            {displayPartners.map((partner) => (
              <PartnerCardView
                key={partner.id}
                partner={partner}
                categoryLabel={
                  categoryMap.get(partner.category)?.label ?? "알 수 없음"
                }
                categoryColor={categoryMap.get(partner.category)?.color}
                viewerAuthenticated={viewerAuthenticated}
                onCategoryClick={handleCategoryChange}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
