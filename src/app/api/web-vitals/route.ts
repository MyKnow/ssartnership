import { NextResponse } from "next/server";
import { JsonRequestBodyError, readJsonRequestBodyWithinLimit } from "@/lib/request-body-limit";
import { createVitalIngressQuota, parseVitalSample } from "@/lib/web-vitals-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const consumeQuota = createVitalIngressQuota();

function enabled() {
  return process.env.SELF_HOST_MODE === "real" && process.env.SELF_HOST_VITALS_ENABLED === "1";
}

export function GET() {
  const rate = Number(process.env.SELF_HOST_VITALS_SAMPLE_RATE ?? "0.1");
  return NextResponse.json({ enabled: enabled(), sampleRate: Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : 0.1 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!enabled()) return new Response(null, { status: 404 });
  // Use the configured origin, not Host/X-Forwarded-Host from the caller.
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || request.headers.get("origin") !== origin || request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") return new Response(null, { status: 403 });
  // A bounded process-wide admission gate uses no client identifier. Edge
  // per-IP limits may add protection, but forged headers cannot bypass this.
  if (!consumeQuota()) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  try {
    const sample = parseVitalSample(await readJsonRequestBodyWithinLimit<unknown>(request, 512));
    if (!sample) return new Response(null, { status: 400 });
    const token = process.env.SELF_HOST_VITALS_TOKEN;
    if (!token || token.length < 32) return new Response(null, { status: 503 });
    const response = await fetch("http://telemetry:9464/vitals", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(2000), cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sample),
    });
    await response.body?.cancel();
    return new Response(null, { status: response.ok ? 204 : 503 });
  } catch (error) {
    return new Response(null, { status: error instanceof JsonRequestBodyError ? (error.code === "body_too_large" ? 413 : 400) : 503 });
  }
}
