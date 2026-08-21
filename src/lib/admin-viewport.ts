export const ADMIN_VIEWPORTS = ["mobile", "tablet", "desktop"] as const;

export type AdminViewport = (typeof ADMIN_VIEWPORTS)[number];

export function getAdminViewport(width: number): AdminViewport {
  if (!Number.isFinite(width) || width < 768) {
    return "mobile";
  }
  if (width < 1_200) {
    return "tablet";
  }
  return "desktop";
}

export function getCurrentAdminViewport(): AdminViewport | null {
  if (typeof window === "undefined") {
    return null;
  }
  return getAdminViewport(window.innerWidth);
}

export function parseAdminViewport(value: unknown): AdminViewport | "unknown" {
  return typeof value === "string" && (ADMIN_VIEWPORTS as readonly string[]).includes(value)
    ? (value as AdminViewport)
    : "unknown";
}
