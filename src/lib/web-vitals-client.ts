import { classifyVitalRoute, parseVitalSample } from "./web-vitals-contract.ts";

type VitalTransport = (url: string, init: RequestInit) => Promise<unknown>;

export async function sendWebVital(
  metric: { name: string; value: number },
  pathname: string,
  transport: VitalTransport = fetch,
): Promise<void> {
  const sample = parseVitalSample({
    name: metric.name,
    value: metric.value,
    route: classifyVitalRoute(pathname),
  });
  if (!sample) return;

  try {
    // Keep navigation-time metrics alive without sending cookies or metric IDs.
    await transport("/api/web-vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sample),
      keepalive: true,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    // Telemetry is best effort: never retry or interrupt a user's navigation.
  }
}
