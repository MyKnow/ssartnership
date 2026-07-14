"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category, CategoryKey, Partner } from "@/lib/types";
import PartnerFilters, {
  type PartnerSortOption,
} from "@/components/PartnerFilters";
import PartnerActiveFilters from "@/components/partner-filters/PartnerActiveFilters";
import PartnerDirectoryToolbar from "@/components/partner-filters/PartnerDirectoryToolbar";
import MotionReveal from "@/components/ui/MotionReveal";
import PartnerCardView from "@/components/PartnerCardView";
import SectionHeading from "@/components/ui/SectionHeading";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { HOME_COPY } from "@/lib/content";
import { trackProductEvent } from "@/lib/product-events";
import { useToast } from "@/components/ui/Toast";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";
import {
  createHomeCategoryMap,
  filterHomePartners,
  normalizeHomePartners,
} from "@/components/home-view/selectors";
import {
  parseHomeDirectoryState,
  serializeHomeDirectoryState,
  type HomeDirectoryState,
} from "@/lib/home-directory-state";

const INITIAL_PARTNER_CARD_COUNT = 12;
const PARTNER_CARD_INCREMENT = 12;

export default function HomeView({
  categories,
  partners,
  viewerAuthenticated,
  currentUserId,
  partnerPopularityById,
  partnerFavoriteStateById,
  loadedPartnerStateIds,
}: {
  categories: Category[];
  partners: Partner[];
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  partnerPopularityById?: Record<string, PartnerPopularityMetrics | undefined>;
  partnerFavoriteStateById?: Record<string, boolean | undefined>;
  loadedPartnerStateIds?: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryKeys = useMemo(
    () => categories.map((category) => category.key),
    [categories],
  );
  const directoryState = useMemo(
    () => parseHomeDirectoryState(searchParams, categoryKeys),
    [categoryKeys, searchParams],
  );
  const activeCategory = directoryState.category;
  const campusFilter = directoryState.campus;
  const appliesToFilter = directoryState.audience;
  const sortValue = directoryState.sort;
  const searchValue = directoryState.q;
  const viewMode = directoryState.view;
  const [visibleCardState, setVisibleCardState] = useState({
    key: "",
    limit: INITIAL_PARTNER_CARD_COUNT,
  });
  const [localPopularityById, setLocalPopularityById] = useState<
    Record<string, PartnerPopularityMetrics | undefined>
  >(partnerPopularityById ?? {});
  const [localFavoriteStateById, setLocalFavoriteStateById] = useState<
    Record<string, boolean | undefined>
  >(partnerFavoriteStateById ?? {});
  const [loadedPartnerStateIdSet, setLoadedPartnerStateIdSet] = useState(
    () => new Set(loadedPartnerStateIds ?? []),
  );
  const deferredSearchValue = useDeferredValue(searchValue);
  const searchTimeoutRef = useRef<number | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastLoggedSearchRef = useRef("");
  const { notify } = useToast();

  const replaceDirectoryState = useCallback(
    (nextState: Partial<HomeDirectoryState>) => {
      const currentParams = new URLSearchParams(window.location.search);
      const currentDirectoryState = parseHomeDirectoryState(
        currentParams,
        categoryKeys,
      );
      const params = serializeHomeDirectoryState(
        { ...currentDirectoryState, ...nextState },
        currentParams,
      );
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        query ? `${pathname}?${query}#benefits` : `${pathname}#benefits`,
      );
    },
    [categoryKeys, pathname],
  );

  const directoryReturnTo = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}#benefits` : `${pathname}#benefits`;
  }, [pathname, searchParams]);

  const categoryMap = useMemo(() => {
    return createHomeCategoryMap(categories);
  }, [categories]);

  const normalizedPartners = useMemo(
    () =>
      normalizeHomePartners(
        partners,
        viewerAuthenticated,
        localPopularityById,
      ),
    [localPopularityById, partners, viewerAuthenticated],
  );

  const filteredPartners = useMemo(() => {
    return filterHomePartners({
      partners: normalizedPartners,
      activeCategory,
      campusFilter,
      appliesToFilter,
      searchValue: deferredSearchValue,
      sortValue,
    });
  }, [
    activeCategory,
    campusFilter,
    appliesToFilter,
    deferredSearchValue,
    normalizedPartners,
    sortValue,
  ]);

  const visibleCardKey = `${activeCategory}:${campusFilter}:${appliesToFilter}:${deferredSearchValue}:${sortValue}:${viewMode}`;
  const visibleCardLimit =
    visibleCardState.key === visibleCardKey
      ? visibleCardState.limit
      : INITIAL_PARTNER_CARD_COUNT;
  const displayPartners = filteredPartners.display.slice(0, visibleCardLimit);
  const hasMoreDisplayPartners =
    filteredPartners.display.length > displayPartners.length;
  const displayPartnerIds = useMemo(
    () => displayPartners.map((partner) => partner.id),
    [displayPartners],
  );

  const visibleResultCount = filteredPartners.visible.length;
  const directoryResultCount = filteredPartners.display.length;

  const loadMorePartners = useCallback(() => {
    if (!hasMoreDisplayPartners) {
      return;
    }
    startTransition(() => {
      setVisibleCardState((prev) => ({
        key: visibleCardKey,
        limit:
          prev.key === visibleCardKey
            ? prev.limit + PARTNER_CARD_INCREMENT
            : INITIAL_PARTNER_CARD_COUNT + PARTNER_CARD_INCREMENT,
      }));
    });
  }, [hasMoreDisplayPartners, visibleCardKey]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMoreDisplayPartners) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMorePartners();
        }
      },
      { rootMargin: "480px 0px 640px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreDisplayPartners, loadMorePartners]);

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
    const missingPartnerIds = displayPartnerIds.filter(
      (partnerId) => !loadedPartnerStateIdSet.has(partnerId),
    );
    if (missingPartnerIds.length === 0) {
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams();
    for (const partnerId of missingPartnerIds) {
      params.append("id", partnerId);
    }

    fetch(`/api/partners/home-state?${params.toString()}`, {
      credentials: "same-origin",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("home_state_failed");
        }
        return (await response.json()) as {
          loadedPartnerIds?: string[];
          partnerFavoriteStateById?: Record<string, boolean | undefined>;
          partnerPopularityById?: Record<
            string,
            PartnerPopularityMetrics | undefined
          >;
        };
      })
      .then((state) => {
        setLocalPopularityById((current) => ({
          ...current,
          ...(state.partnerPopularityById ?? {}),
        }));
        setLocalFavoriteStateById((current) => ({
          ...current,
          ...(state.partnerFavoriteStateById ?? {}),
        }));
        setLoadedPartnerStateIdSet((current) => {
          const next = new Set(current);
          for (const partnerId of state.loadedPartnerIds ?? []) {
            next.add(partnerId);
          }
          return next;
        });
      })
      .catch((error) => {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("[home-view] partner state hydration failed", error);
      });

    return () => abortController.abort();
  }, [displayPartnerIds, loadedPartnerStateIdSet]);

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
      const dedupeKey = `${activeCategory}:${campusFilter}:${appliesToFilter}:${sortValue}:${query}`;
      if (lastLoggedSearchRef.current === dedupeKey) {
        return;
      }
      lastLoggedSearchRef.current = dedupeKey;
      trackProductEvent({
        eventName: "search_execute",
        targetType: "partner_search",
        properties: {
          hasQuery: true,
          queryLength: query.length,
          categoryKey: activeCategory,
          campusFilter,
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
  }, [
    activeCategory,
    campusFilter,
    appliesToFilter,
    deferredSearchValue,
    sortValue,
    visibleResultCount,
  ]);

  const handleCategoryChange = (nextCategory: CategoryKey | "all") => {
    startTransition(() => {
      replaceDirectoryState({ category: nextCategory });
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
      replaceDirectoryState({ sort: nextSort });
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

  const handleCampusFilterChange = (
    nextCampus: HomeDirectoryState["campus"],
  ) => {
    startTransition(() => {
      replaceDirectoryState({ campus: nextCampus });
    });
  };

  const handleAppliesToFilterChange = (
    nextAudience: HomeDirectoryState["audience"],
  ) => {
    startTransition(() => {
      replaceDirectoryState({ audience: nextAudience });
    });
  };

  const handleViewModeChange = (nextViewMode: HomeDirectoryState["view"]) => {
    startTransition(() => {
      replaceDirectoryState({ view: nextViewMode });
    });
    trackProductEvent({
      eventName: "directory_view_change",
      targetType: "partner_directory",
      targetId: nextViewMode,
      properties: {
        viewMode: nextViewMode,
      },
    });
  };

  const handleSearchChange = (nextValue: string) => {
    startTransition(() => {
      replaceDirectoryState({ q: nextValue });
    });
  };

  const handleFavoriteChange = (partnerId: string, nextFavorited: boolean) => {
    setLocalPopularityById((current) => {
      const currentMetrics = current[partnerId] ?? {
        favoriteCount: 0,
        reviewCount: 0,
        detailViews: 0,
      };
      return {
        ...current,
        [partnerId]: {
          ...currentMetrics,
          favoriteCount: Math.max(
            0,
            (currentMetrics.favoriteCount ?? 0) + (nextFavorited ? 1 : -1),
          ),
        },
      };
    });
  };

  return (
    <MotionReveal delay={0.04}>
      <section id="benefits" className="flex scroll-mt-24 flex-col gap-6 pt-10">
        <SectionHeading
          eyebrow="Directory"
          title={HOME_COPY.categoryTitle}
          description={HOME_COPY.categoryDescription}
          headingLevel="h2"
        />
        <div className="grid min-w-0 gap-6 min-[840px]:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)] min-[840px]:items-start min-[1200px]:grid-cols-[18rem_minmax(0,1fr)]">
          <div
            className="min-w-0 min-[840px]:sticky min-[840px]:top-24 min-[840px]:self-start"
            data-nosnippet
          >
            <PartnerFilters
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              searchValue={searchValue}
              onSearchChange={handleSearchChange}
              campusFilter={campusFilter}
              onCampusFilterChange={handleCampusFilterChange}
              appliesToFilter={appliesToFilter}
              onAppliesToFilterChange={handleAppliesToFilterChange}
              sortValue={sortValue}
              onSortChange={handleSortChange}
              mode="home-directory"
            />
          </div>
          <div
            className="grid min-w-0 content-start gap-5"
            data-testid="partner-results-pane"
          >
            <PartnerActiveFilters
              categories={categories}
              searchValue={searchValue}
              activeCategory={activeCategory}
              campusFilter={campusFilter}
              appliesToFilter={appliesToFilter}
              sortValue={sortValue}
              onSearchChange={handleSearchChange}
              onCategoryChange={handleCategoryChange}
              onCampusFilterChange={handleCampusFilterChange}
              onAppliesToFilterChange={handleAppliesToFilterChange}
              onSortChange={handleSortChange}
            />
            <PartnerDirectoryToolbar
              resultCount={directoryResultCount}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          {displayPartners.length === 0 ? (
            <div data-testid="partner-no-results">
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
            </div>
          ) : (
            <div className="grid gap-6">
              <div
                className={cn(
                  "grid grid-cols-1",
                  viewMode === "list"
                    ? "gap-3"
                    : "gap-4 min-[600px]:max-[840px]:grid-cols-2 min-[1200px]:grid-cols-2 min-[1200px]:gap-5",
                )}
                data-testid="partner-grid"
                data-view-mode={viewMode}
              >
                {displayPartners.map((partner) => (
                  <PartnerCardView
                    key={partner.id}
                    partner={partner}
                    categoryLabel={
                      categoryMap.get(partner.category)?.label ?? "알 수 없음"
                    }
                    categoryColor={categoryMap.get(partner.category)?.color}
                    viewerAuthenticated={viewerAuthenticated}
                    currentUserId={currentUserId}
                    isFavorited={localFavoriteStateById?.[partner.id] ?? false}
                    metrics={localPopularityById?.[partner.id]}
                    onCategoryClick={handleCategoryChange}
                    onFavoriteChange={handleFavoriteChange}
                    returnTo={directoryReturnTo}
                    variant={viewMode}
                  />
                ))}
              </div>
              {hasMoreDisplayPartners ? (
                <div
                  ref={loadMoreSentinelRef}
                  aria-hidden="true"
                  className="h-10"
                  data-testid="partner-infinite-scroll-sentinel"
                >
                  <span className="sr-only">다음 제휴처를 불러오는 중</span>
                </div>
              ) : null}
            </div>
          )}
          </div>
        </div>
      </section>
    </MotionReveal>
  );
}
