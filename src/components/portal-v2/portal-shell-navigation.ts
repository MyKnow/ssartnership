import type { ComponentType } from "react";

export type PortalNavIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export type PortalNavItem = {
  id: string;
  href: string;
  label: string;
  icon: PortalNavIcon;
  active?: boolean;
  /** Short count or status shown next to the label, e.g. "3". */
  badge?: string;
};

export type PortalNavGroup = {
  id: string;
  label?: string;
  items: PortalNavItem[];
};

/** The mobile bottom bar has four slots: three destinations plus "더보기". */
export const PORTAL_MOBILE_NAV_MAX_ITEMS = 3;

function stripQueryAndHash(href: string) {
  const end = href.search(/[?#]/);
  const path = end === -1 ? href : href.slice(0, end);
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * Whether `pathname` is inside the nav destination `href`.
 * `exact` matches only the destination itself (used for home/dashboard items
 * whose href is a prefix of every other item).
 */
export function isPortalPathActive(
  pathname: string,
  href: string,
  { exact = false }: { exact?: boolean } = {},
) {
  const target = stripQueryAndHash(href);
  const current = stripQueryAndHash(pathname);
  if (current === target) {
    return true;
  }
  if (exact || target === "/") {
    return false;
  }
  return current.startsWith(`${target}/`);
}

/** The bottom bar's slots; anything beyond them is reached through "더보기". */
export function selectPortalMobileNavItems(items: PortalNavItem[]) {
  return items.slice(0, PORTAL_MOBILE_NAV_MAX_ITEMS);
}

/** "더보기" is current when the active destination is not one of the bottom bar slots. */
export function isPortalMoreNavActive(
  groups: PortalNavGroup[],
  mobileItems: PortalNavItem[],
) {
  const visibleIds = new Set(mobileItems.map((item) => item.id));
  return groups.some((group) =>
    group.items.some((item) => item.active && !visibleIds.has(item.id)),
  );
}
