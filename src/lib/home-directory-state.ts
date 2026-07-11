import {
  isCampusSlug,
  type CampusSlug,
} from "./campuses.ts";
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

export const HOME_DIRECTORY_VIEW_OPTIONS = ["card", "list"] as const;

export type HomeDirectoryView =
  (typeof HOME_DIRECTORY_VIEW_OPTIONS)[number];

export type HomeDirectoryState = {
  q: string;
  category: string | "all";
  campus: CampusSlug | "all";
  audience: PartnerAudienceFilter;
  sort: HomeDirectorySort;
  view: HomeDirectoryView;
};

export const DEFAULT_HOME_DIRECTORY_STATE: HomeDirectoryState = {
  q: "",
  category: "all",
  campus: "all",
  audience: "all",
  sort: "popular",
  view: "card",
};

function isHomeDirectorySort(value: string): value is HomeDirectorySort {
  return HOME_DIRECTORY_SORT_OPTIONS.includes(value as HomeDirectorySort);
}

function isHomeDirectoryView(value: string): value is HomeDirectoryView {
  return HOME_DIRECTORY_VIEW_OPTIONS.includes(value as HomeDirectoryView);
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
  const rawCampus = searchParams.get("campus")?.trim() ?? "";
  const rawView = searchParams.get("view")?.trim() ?? "";

  return {
    q: searchParams.get("q")?.trim() ?? "",
    category: parseCategory(
      searchParams.get("category")?.trim() ?? "",
      allowedCategories,
    ),
    campus:
      rawCampus === "all" || isCampusSlug(rawCampus)
        ? rawCampus
        : DEFAULT_HOME_DIRECTORY_STATE.campus,
    audience:
      rawAudience === "all" || isPartnerAudienceKey(rawAudience)
        ? rawAudience
        : DEFAULT_HOME_DIRECTORY_STATE.audience,
    sort: isHomeDirectorySort(rawSort)
      ? rawSort
      : DEFAULT_HOME_DIRECTORY_STATE.sort,
    view: isHomeDirectoryView(rawView)
      ? rawView
      : DEFAULT_HOME_DIRECTORY_STATE.view,
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
    ["campus", state.campus, DEFAULT_HOME_DIRECTORY_STATE.campus],
    ["audience", state.audience, DEFAULT_HOME_DIRECTORY_STATE.audience],
    ["sort", state.sort, DEFAULT_HOME_DIRECTORY_STATE.sort],
    ["view", state.view, DEFAULT_HOME_DIRECTORY_STATE.view],
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
