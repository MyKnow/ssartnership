export const VITAL_ROUTES = ["home", "partner-detail", "directory", "member", "admin", "partner-portal", "auth", "other"] as const;
export const VITAL_NAMES = ["LCP", "INP", "CLS"] as const;
export type VitalSample = { name: typeof VITAL_NAMES[number]; route: typeof VITAL_ROUTES[number]; value: number };

// Deliberately never return a pathname, ID, query, fragment or referrer.
export function classifyVitalRoute(pathname: string): VitalSample["route"] {
  const value = pathname.split(/[?#]/u, 1)[0];
  if (value === "/") return "home";
  if (/^\/partners\/[^/]+\/?$/u.test(value)) return "partner-detail";
  if (value === "/partners") return "directory";
  if (/^\/admin(?:\/|$)/u.test(value)) return "admin";
  if (/^\/partner(?:\/|$)/u.test(value)) return "partner-portal";
  if (/^\/(?:member|my|certification)(?:\/|$)/u.test(value)) return "member";
  if (/^\/auth(?:\/|$)/u.test(value)) return "auth";
  return "other";
}

export function parseVitalSample(input: unknown): VitalSample | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 3 || Object.keys(value).some((key) => !["name", "route", "value"].includes(key))) return null;
  if (!VITAL_NAMES.includes(value.name as VitalSample["name"]) || !VITAL_ROUTES.includes(value.route as VitalSample["route"])) return null;
  if (typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0 || value.value > (value.name === "CLS" ? 100 : 300_000)) return null;
  return { name: value.name as VitalSample["name"], route: value.route as VitalSample["route"], value: value.value };
}

export function createVitalIngressQuota(limit = 1200, now = Date.now) {
  let windowStart = now();
  let count = 0;
  return () => {
    const time = now();
    if (time - windowStart >= 60_000 || time < windowStart) { windowStart = time; count = 0; }
    count += 1;
    return count <= limit;
  };
}
