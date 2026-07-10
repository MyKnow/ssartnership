import {
  isPartnerAudienceKey,
  type PartnerAudienceFilter,
} from "./partner-audience.ts";

export const HOME_DIRECTORY_SORT_OPTIONS = [
  "popular",
  "recent",
  "endingSoon",
] as const;

export type HomeDirectorySort =
  (typeof HOME_DIRECTORY_SORT_OPTIONS)[number];

export type HomeDirectoryState = {
  q: string;
  category: string | "all";
  audience: PartnerAudienceFilter;
  sort: HomeDirectorySort;
};

export const DEFAULT_HOME_DIRECTORY_STATE: HomeDirectoryState = {
  q: "",
  category: "all",
  audience: "all",
  sort: "popular",
};

function isHomeDirectorySort(value: string): value is HomeDirectorySort {
  return HOME_DIRECTORY_SORT_OPTIONS.includes(value as HomeDirectorySort);
}

function parseCategory(value: string, allowedCategories?: readonly string[]) {
  if (!value || value === "all") {
    return "all";
  }
  if (allowedCategories) {
    return allowedCategories.includes(value) ? value : "all";
  }
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value) ? value : "all";
}

export function parseHomeDirectoryState(
  searchParams: Pick<URLSearchParams, "get">,
  allowedCategories?: readonly string[],
): HomeDirectoryState {
  const rawAudience = searchParams.get("audience")?.trim() ?? "";
  const rawSort = searchParams.get("sort")?.trim() ?? "";

  return {
    q: searchParams.get("q")?.trim() ?? "",
    category: parseCategory(
      searchParams.get("category")?.trim() ?? "",
      allowedCategories,
    ),
    audience:
      rawAudience === "all" || isPartnerAudienceKey(rawAudience)
        ? rawAudience
        : DEFAULT_HOME_DIRECTORY_STATE.audience,
    sort: isHomeDirectorySort(rawSort)
      ? rawSort
      : DEFAULT_HOME_DIRECTORY_STATE.sort,
  };
}

export function serializeHomeDirectoryState(
  state: HomeDirectoryState,
  currentParams: Pick<URLSearchParams, "toString"> = new URLSearchParams(),
) {
  const params = new URLSearchParams(currentParams.toString());
  const entries = [
    ["q", state.q.trim(), DEFAULT_HOME_DIRECTORY_STATE.q],
    ["category", state.category, DEFAULT_HOME_DIRECTORY_STATE.category],
    ["audience", state.audience, DEFAULT_HOME_DIRECTORY_STATE.audience],
    ["sort", state.sort, DEFAULT_HOME_DIRECTORY_STATE.sort],
  ] as const;

  for (const [key, value, defaultValue] of entries) {
    if (!value || value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  return params;
}

export function buildPartnerDetailHref(
  partnerId: string,
  returnTo?: string | null,
) {
  const pathname = `/partners/${encodeURIComponent(partnerId)}`;
  if (!returnTo) {
    return pathname;
  }
  const params = new URLSearchParams({ returnTo });
  return `${pathname}?${params.toString()}`;
}
