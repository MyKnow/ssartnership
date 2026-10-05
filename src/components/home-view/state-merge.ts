import type { HomeDirectoryState } from "@/lib/home-directory-state";

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

export function mergeFavoriteState(current: Record<string, boolean | undefined>, incoming: FavoriteStateResponse) {
  return { ...current, ...(incoming.partnerFavoriteStateById ?? {}) };
}

export function mergeLoadedPartnerIds(current: ReadonlySet<string>, incoming: FavoriteStateResponse) {
  return new Set([...current, ...(incoming.loadedFavoritePartnerIds ?? [])]);
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
