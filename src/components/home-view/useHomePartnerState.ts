"use client";
import { useEffect, type Dispatch } from "react";
import type { HomePartnerStateAction } from "./state-merge";
export function useHomePartnerState({ currentUserId, displayPartnerIds, loadedFavoritePartnerIdSet, dispatch }: {
  currentUserId: string | null; displayPartnerIds: string[]; loadedFavoritePartnerIdSet: Set<string>;
  dispatch: Dispatch<HomePartnerStateAction>;
}) {
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const missingPartnerIds = displayPartnerIds.filter(
      (partnerId) => !loadedFavoritePartnerIdSet.has(partnerId),
    );
    if (missingPartnerIds.length === 0) {
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams();
    for (const partnerId of missingPartnerIds) {
      params.append("id", partnerId);
    }
    params.set("includeFavorites", "1");
    params.set("includePopularity", "0");

    fetch(`/api/partners/home-state?${params.toString()}`, {
      credentials: "same-origin",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("home_state_failed");
        }
        return (await response.json()) as {
          loadedFavoritePartnerIds?: string[];
          partnerFavoriteStateById?: Record<string, boolean | undefined>;
        };
      })
      .then((state) => {
        if (!abortController.signal.aborted) dispatch({ type: "hydrate", response: state });
      })
      .catch((error) => {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("[home-view] partner state hydration failed", error);
      });

    return () => abortController.abort();
  }, [currentUserId, displayPartnerIds, loadedFavoritePartnerIdSet, dispatch]);

}
