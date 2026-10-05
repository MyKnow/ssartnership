"use client";
import { useEffect, useRef } from "react";
import { trackProductEvent } from "@/lib/product-events";
import { searchEventDedupeKey } from "./state-merge";
export function useHomeSearchAnalytics({ activeCategory, campusFilter, appliesToFilter, deferredSearchValue, sortValue, visibleResultCount }: {
  activeCategory: string; campusFilter: string; appliesToFilter: string; deferredSearchValue: string; sortValue: string; visibleResultCount: number;
}) {
  const searchTimeoutRef = useRef<number | null>(null);
  const lastLoggedSearchRef = useRef("");
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
      const dedupeKey = searchEventDedupeKey(activeCategory, campusFilter, appliesToFilter, sortValue, query);
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

}
