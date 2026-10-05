"use client";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { mergeFavoriteState, mergeLoadedPartnerIds } from "./state-merge";
export function useHomePartnerState({ currentUserId, displayPartnerIds, loadedFavoritePartnerIdSet, setLocalFavoriteStateById, setLoadedFavoritePartnerIdSet }: {
  currentUserId: string | null; displayPartnerIds: string[]; loadedFavoritePartnerIdSet: Set<string>;
  setLocalFavoriteStateById: Dispatch<SetStateAction<Record<string, boolean | undefined>>>;
  setLoadedFavoritePartnerIdSet: Dispatch<SetStateAction<Set<string>>>;
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
        setLocalFavoriteStateById((current) => mergeFavoriteState(current, state));
        setLoadedFavoritePartnerIdSet((current) => mergeLoadedPartnerIds(current, state));
      })
      .catch((error) => {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("[home-view] partner state hydration failed", error);
      });

    return () => abortController.abort();
  }, [currentUserId, displayPartnerIds, loadedFavoritePartnerIdSet, setLocalFavoriteStateById, setLoadedFavoritePartnerIdSet]);

}
