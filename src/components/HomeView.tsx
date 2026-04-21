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
import MotionReveal from "@/components/ui/MotionReveal";
import PartnerCardView from "@/components/PartnerCardView";
import SectionHeading from "@/components/ui/SectionHeading";
import EmptyState from "@/components/ui/EmptyState";
import { HOME_COPY } from "@/lib/content";
import { trackProductEvent } from "@/lib/product-events";
import { useToast } from "@/components/ui/Toast";
import {
  type PartnerAudienceFilter,
} from "@/lib/partner-audience";
import {
  createHomeCategoryMap,
  filterHomePartners,
  normalizeHomePartners,
} from "@/components/home-view/selectors";

const APPLIES_TO_FILTER_STORAGE_KEY = "home:partner-applies-to-filter";

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
    return createHomeCategoryMap(categories);
  }, [categories]);

  const normalizedPartners = useMemo(
    () => normalizeHomePartners(partners, viewerAuthenticated),
    [partners, viewerAuthenticated],
  );

  const filteredPartners = useMemo(() => {
    return filterHomePartners({
      partners: normalizedPartners,
      activeCategory,
      appliesToFilter,
      searchValue: deferredSearchValue,
      sortValue,
    });
  }, [activeCategory, appliesToFilter, deferredSearchValue, normalizedPartners, sortValue]);

  const displayPartners = filteredPartners.display;

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
      <MotionReveal delay={0.04}>
        <section className="mt-10 flex flex-col gap-6">
          <SectionHeading
            eyebrow="Directory"
            title={HOME_COPY.categoryTitle}
            description={HOME_COPY.categoryDescription}
          />
          <div data-nosnippet>
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
          </div>
        </section>
      </MotionReveal>

      <MotionReveal delay={0.08}>
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
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
      </MotionReveal>
    </>
  );
}
