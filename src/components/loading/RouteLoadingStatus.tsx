export const ROUTE_LOADING_STATUS_TEXT = "화면을 불러오는 중입니다.";

/**
 * Single screen-reader announcement for a route-level `loading.tsx`.
 * Skeleton blocks stay `aria-hidden`; render this once per route fallback and
 * never inside page-level Suspense fallbacks, so a page has one live region.
 */
export default function RouteLoadingStatus({
  label = ROUTE_LOADING_STATUS_TEXT,
}: {
  label?: string;
}) {
  return (
    <p role="status" className="sr-only" data-route-loading-status>
      {label}
    </p>
  );
}
