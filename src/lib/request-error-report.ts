import { normalizeProductEventLocation } from "./product-event-path.ts";
import { logServerError } from "./server-log.ts";

/**
 * Next.js `onRequestError` adapter. The request/context shapes mirror
 * `Instrumentation.onRequestError` in Next 16 but are declared structurally
 * so this module stays testable without the framework runtime.
 */
export type RequestErrorRequest = {
  path?: unknown;
  method?: unknown;
};

export type RequestErrorContext = {
  routerKind?: unknown;
  routePath?: unknown;
  routeType?: unknown;
  renderSource?: unknown;
  revalidateReason?: unknown;
};

const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const ROUTE_TYPES = new Set(["render", "route", "action", "proxy"]);
const RENDER_SOURCES = new Set([
  "react-server-components",
  "react-server-components-payload",
  "server-rendering",
]);
const REVALIDATE_REASONS = new Set(["on-demand", "stale"]);
const ROUTE_GROUPS = ["admin", "partner", "api", "auth", "events", "certification"] as const;
const SAFE_ROUTE_PATTERN = /^\/[A-Za-z0-9_\-[\]().@/]{0,180}$/u;

export type RequestRouteGroup = (typeof ROUTE_GROUPS)[number] | "site" | "unknown";

function pick(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === "string" && allowed.has(value) ? value : undefined;
}

/** Normalizes a route file path such as `/app/admin/(protected)/page`. */
export function normalizeRoutePattern(routePath: unknown) {
  if (typeof routePath !== "string") {
    return undefined;
  }
  const withoutRoot = routePath.replace(/^\/(?:src\/)?app(?=\/|$)/u, "") || "/";
  return SAFE_ROUTE_PATTERN.test(withoutRoot) ? withoutRoot : undefined;
}

/** Collapses a route pattern or request path into a fixed, low-cardinality group. */
export function getRequestRouteGroup(route: string | null | undefined): RequestRouteGroup {
  if (!route || !route.startsWith("/")) {
    return "unknown";
  }
  const segments = route
    .split(/[?#]/u, 1)[0]
    .split("/")
    .filter((segment) => segment && !/^\(.*\)$/u.test(segment));
  const first = segments[0];
  if (!first) {
    return "site";
  }
  return (ROUTE_GROUPS as readonly string[]).includes(first) ? (first as RequestRouteGroup) : "site";
}

export function buildRequestErrorProperties(
  request: RequestErrorRequest | null | undefined,
  context: RequestErrorContext | null | undefined,
) {
  const route = normalizeRoutePattern(context?.routePath);
  const path = typeof request?.path === "string"
    ? normalizeProductEventLocation(request.path)
    : null;
  const method = typeof request?.method === "string" ? request.method.toUpperCase() : "";
  return {
    routeGroup: getRequestRouteGroup(route ?? path),
    route: route ?? null,
    path,
    method: METHODS.has(method) ? method : "OTHER",
    routeType: pick(context?.routeType, ROUTE_TYPES) ?? "unknown",
    renderSource: pick(context?.renderSource, RENDER_SOURCES) ?? null,
    revalidateReason: pick(context?.revalidateReason, REVALIDATE_REASONS) ?? null,
  };
}

/** Records one sanitized line per captured server error. Never throws. */
export function reportRequestError(
  error: unknown,
  request: RequestErrorRequest | null | undefined,
  context: RequestErrorContext | null | undefined,
) {
  try {
    logServerError("[request-error] unhandled server error", error, buildRequestErrorProperties(request, context));
  } catch {
    // Error reporting must never replace the original failure.
  }
}
