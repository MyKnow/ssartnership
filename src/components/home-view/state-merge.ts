import type { HomeDirectoryState } from "@/lib/home-directory-state";
import type { PartnerPopularityMetrics } from "@/lib/partner-popularity";

export function homeDirectoryKey(state: HomeDirectoryState) {
  return `${state.category}:${state.campus}:${state.audience}:${state.q}:${state.sort}:${state.view}`;
}

export function isHomeHistoryReturn(marker: string | null, navigationType?: string) {
  return marker === "1" || navigationType === "back_forward";
}

export type FavoriteStateResponse = {
  loadedFavoritePartnerIds?: string[];
  partnerFavoriteStateById?: Record<string, boolean | undefined>;
};

export function mergeFavoriteState(current: Record<string, boolean | undefined>, incoming: FavoriteStateResponse, locallyChangedIds?: ReadonlySet<string>) {
  const favorites = { ...current };
  for (const [id, favorite] of Object.entries(incoming.partnerFavoriteStateById ?? {})) {
    if (!locallyChangedIds?.has(id)) favorites[id] = favorite;
  }
  return favorites;
}

export function mergeLoadedPartnerIds(current: ReadonlySet<string>, incoming: FavoriteStateResponse) {
  return new Set([...current, ...(incoming.loadedFavoritePartnerIds ?? [])]);
}

type FavoriteMutationSnapshot = {
  favorite: boolean | undefined;
  popularity: PartnerPopularityMetrics | undefined;
  loaded: boolean;
  locallyChanged: boolean;
};

type HomePartnerState = {
  favorites: Record<string, boolean | undefined>;
  popularity: Record<string, PartnerPopularityMetrics | undefined>;
  loadedIds: Set<string>;
  locallyChangedIds: Set<string>;
  pendingIds: Set<string>;
  mutationSnapshots: Map<string, FavoriteMutationSnapshot>;
};

export type HomePartnerStateAction =
  | { type: "hydrate"; response: FavoriteStateResponse }
  | { type: "favorite"; partnerId: string; favorite: boolean; count?: number }
  | { type: "pending"; partnerId: string; pending: boolean; outcome?: "success" | "failure" };

export function createHomePartnerState({ favorites = {}, popularity = {}, loadedIds = [] }: {
  favorites?: HomePartnerState["favorites"];
  popularity?: HomePartnerState["popularity"];
  loadedIds?: string[];
}): HomePartnerState {
  return { favorites, popularity, loadedIds: new Set(loadedIds), locallyChangedIds: new Set(), pendingIds: new Set(), mutationSnapshots: new Map() };
}

/** Keep mutation and request state above cards, which filters can unmount. */
export function homePartnerStateReducer(state: HomePartnerState, action: HomePartnerStateAction): HomePartnerState {
  if (action.type === "hydrate") {
    return {
      ...state,
      favorites: mergeFavoriteState(state.favorites, action.response, state.locallyChangedIds),
      loadedIds: mergeLoadedPartnerIds(state.loadedIds, action.response),
    };
  }
  if (action.type === "pending") {
    const pendingIds = new Set(state.pendingIds);
    const mutationSnapshots = new Map(state.mutationSnapshots);
    if (action.pending) {
      if (pendingIds.has(action.partnerId)) return state;
      pendingIds.add(action.partnerId);
      mutationSnapshots.set(action.partnerId, {
        favorite: state.favorites[action.partnerId],
        popularity: state.popularity[action.partnerId],
        loaded: state.loadedIds.has(action.partnerId),
        locallyChanged: state.locallyChangedIds.has(action.partnerId),
      });
      return { ...state, pendingIds, mutationSnapshots };
    }
    pendingIds.delete(action.partnerId);
    const snapshot = mutationSnapshots.get(action.partnerId);
    mutationSnapshots.delete(action.partnerId);
    if (action.outcome !== "failure" || !snapshot) return { ...state, pendingIds, mutationSnapshots };

    // Unknown before the request must remain eligible for hydration after failure.
    // Restore only this card; another card can have changed while it was pending.
    const loadedIds = new Set(state.loadedIds);
    const locallyChangedIds = new Set(state.locallyChangedIds);
    if (snapshot.loaded) loadedIds.add(action.partnerId);
    else loadedIds.delete(action.partnerId);
    if (snapshot.locallyChanged) locallyChangedIds.add(action.partnerId);
    else locallyChangedIds.delete(action.partnerId);
    return {
      ...state, pendingIds, mutationSnapshots, loadedIds, locallyChangedIds,
      favorites: { ...state.favorites, [action.partnerId]: snapshot.favorite },
      popularity: { ...state.popularity, [action.partnerId]: snapshot.popularity },
    };
  }
  const previousFavorite = state.favorites[action.partnerId] ?? false;
  const metrics = state.popularity[action.partnerId];
  const delta = Number(action.favorite) - Number(previousFavorite);
  const favoriteCount = typeof action.count === "number" && Number.isFinite(action.count)
    ? Math.max(0, action.count)
    : Math.max(0, (metrics?.favoriteCount ?? 0) + delta);
  return {
    ...state,
    favorites: { ...state.favorites, [action.partnerId]: action.favorite },
    popularity: { ...state.popularity, [action.partnerId]: { ...metrics, favoriteCount } },
    loadedIds: new Set([...state.loadedIds, action.partnerId]),
    locallyChangedIds: new Set([...state.locallyChangedIds, action.partnerId]),
  };
}

export function searchEventDedupeKey(category: string, campus: string, audience: string, sort: string, query: string) {
  return `${category}:${campus}:${audience}:${sort}:${query}`;
}

export function parseHomeReturnState(value: string | null, key: string) {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Record<string, unknown>;
    if (state.key !== key || !Number.isSafeInteger(state.limit) || Number(state.limit) < 12 || Number(state.limit) > 10000
      || typeof state.scrollY !== "number" || !Number.isFinite(state.scrollY) || state.scrollY < 0) return null;
    return { key, limit: Number(state.limit), scrollY: state.scrollY };
  } catch { return null; }
}
