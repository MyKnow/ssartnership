import { createClient } from "@supabase/supabase-js";
import {
  summarizeHttpSamples,
  summarizeRouteTiming,
  summarizeTaskOutcome,
  summarizeViewportRouteTiming,
  summarizeViewportTaskOutcome,
  summarizeViewportWebVitals,
  summarizeWebVitals,
} from "./admin-preview-performance-lib.mjs";

const WINDOW_DAYS = 7;
const DEFAULT_ITERATIONS = 30;
const DEFAULT_API_TARGETS = [
  { key: "admin.logs", path: "/api/admin/logs?page=1&pageSize=50&sort=newest" },
  { key: "admin.notifications", path: "/api/admin/notifications?offset=0&limit=20" },
  { key: "admin.push.recipients", path: "/api/admin/push/recipients?limit=20" },
];

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name}_MISSING`);
  }
  return value;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

function getWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { input_start: start.toISOString(), input_end: end.toISOString() };
}

function parseServerTiming(value) {
  if (!value) {
    return {};
  }

  const result = {};
  for (const entry of value.split(",")) {
    const [name, ...parameters] = entry.trim().split(";");
    if (!/^(auth|session|query|storage|total)$/.test(name)) {
      continue;
    }
    const duration = parameters
      .map((parameter) => parameter.trim().match(/^dur=([0-9]+(?:\.[0-9]+)?)$/)?.[1])
      .find(Boolean);
    if (duration) {
      result[name] = Number(duration);
    }
  }
  return result;
}

function parseTargets() {
  const raw = process.env.ADMIN_PREVIEW_API_TARGETS?.trim();
  if (!raw) {
    return DEFAULT_API_TARGETS;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("ADMIN_PREVIEW_API_TARGETS_INVALID");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) {
    throw new Error("ADMIN_PREVIEW_API_TARGETS_INVALID");
  }

  return parsed.map((target) => {
    if (
      !target ||
      typeof target.key !== "string" ||
      !/^admin\.[a-z0-9._-]+$/.test(target.key) ||
      typeof target.path !== "string" ||
      !target.path.startsWith("/api/admin/") ||
      target.path.includes("?") && target.path.includes("#")
    ) {
      throw new Error("ADMIN_PREVIEW_API_TARGETS_INVALID");
    }
    return { key: target.key, path: target.path };
  });
}

async function callSummaryRpc(supabase, functionName, window) {
  const { data, error } = await supabase.rpc(functionName, window);
  if (error) {
    throw new Error(`${functionName}_${error.code || "FAILED"}`);
  }
  return data ?? [];
}

async function measureHttpTarget(baseUrl, cookie, protectionBypass, target, iterations) {
  const samples = [];
  const url = new URL(target.path, baseUrl);
  const headers = {
    Accept: "application/json",
    Cookie: cookie,
    Origin: url.origin,
    Referer: `${url.origin}/admin`,
  };
  if (protectionBypass) {
    headers["x-vercel-protection-bypass"] = protectionBypass;
  }

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    let status = 0;
    let serverTiming = {};
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers,
      });
      status = response.status;
      serverTiming = parseServerTiming(response.headers.get("server-timing"));
      await response.arrayBuffer();
    } catch {
      status = 0;
    }
    samples.push({
      status,
      totalMs: Math.max(0, performance.now() - startedAt),
      serverTiming,
    });
  }
  return { key: target.key, ...summarizeHttpSamples(samples) };
}

async function measureHttpTargets() {
  const baseUrl = process.env.ADMIN_PREVIEW_URL?.trim();
  const cookie = process.env.ADMIN_PREVIEW_SESSION_COOKIE?.trim();
  const protectionBypass = process.env.ADMIN_PREVIEW_PROTECTION_BYPASS?.trim();
  if (!baseUrl || !cookie) {
    return {
      skipped: "ADMIN_PREVIEW_URL_OR_SESSION_COOKIE_MISSING",
      targets: [],
    };
  }

  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.hostname !== "localhost") {
    throw new Error("ADMIN_PREVIEW_URL_INVALID");
  }

  const iterations = parsePositiveInteger(process.env.ADMIN_PREVIEW_ITERATIONS, DEFAULT_ITERATIONS);
  const targets = parseTargets();
  const results = [];
  for (const target of targets) {
    results.push(await measureHttpTarget(parsedBaseUrl, cookie, protectionBypass, target, iterations));
  }
  return { iterations, targets: results };
}

function printTextReport(report) {
  console.log(`Admin Preview performance window: last ${WINDOW_DAYS} days`);
  console.log("\nWeb Vitals p75");
  for (const metric of report.webVitals) {
    console.log(
      `- ${metric.metric}: p75=${metric.p75Value ?? "n/a"}ms, samples=${metric.sampleCount}, status=${metric.status}`,
    );
  }

  console.log("\nRoute timing p75");
  for (const route of report.routeTiming) {
    console.log(
      `- ${route.routeKey}: p75=${route.p75DurationMs ?? "n/a"}ms, samples=${route.sampleCount}, status=${route.status}`,
    );
  }

  console.log("\nTask outcomes");
  for (const task of report.taskOutcome) {
    console.log(
      `- ${task.taskKey}: starts=${task.startCount}, completion=${task.completionRate ?? "n/a"}%, recovery=${task.recoveryRate ?? "n/a"}%, p75=${task.p75DurationMs ?? "n/a"}ms, status=${task.status}`,
    );
  }

  if (report.http.skipped) {
    console.log(`\nHTTP Server-Timing: skipped (${report.http.skipped})`);
  } else {
    console.log("\nHTTP Server-Timing p95");
    for (const target of report.http.targets) {
      const phases = Object.entries(target.serverTimingP95Ms)
        .map(([phase, value]) => `${phase}=${value ?? "n/a"}ms`)
        .join(", ");
      const statuses = Object.entries(target.statusCounts)
        .map(([status, count]) => `${status}=${count}`)
        .join(", ");
      console.log(
        `- ${target.key}: total=${target.totalP95Ms ?? "n/a"}ms, success=${target.successCount}/${target.requestCount}, statuses=${statuses || "none"}${phases ? `, ${phases}` : ""}`,
      );
    }
  }

  console.log("\nViewport dimensions");
  for (const metric of report.dimensions.webVitals) {
    console.log(
      `- ${metric.viewport}/${metric.metric}: p75=${metric.p75Value ?? "n/a"}ms, samples=${metric.sampleCount}, status=${metric.status}`,
    );
  }
  for (const route of report.dimensions.routeTiming) {
    console.log(
      `- ${route.viewport}/${route.routeKey}: p75=${route.p75DurationMs ?? "n/a"}ms, samples=${route.sampleCount}, status=${route.status}`,
    );
  }
}

async function main() {
  const previewUrl = getRequiredEnv("SUPABASE_PREVIEW_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_PREVIEW_SERVICE_ROLE_KEY");
  const supabase = createClient(previewUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const window = getWindow();

  const [
    webVitals,
    routeTiming,
    taskOutcome,
    viewportWebVitals,
    viewportRouteTiming,
    viewportTaskOutcome,
    http,
  ] = await Promise.all([
    callSummaryRpc(supabase, "get_admin_web_vitals_summary", window),
    callSummaryRpc(supabase, "get_admin_route_timing_summary", window),
    callSummaryRpc(supabase, "get_admin_task_outcome_summary", window),
    callSummaryRpc(supabase, "get_admin_web_vitals_dimension_summary", window),
    callSummaryRpc(supabase, "get_admin_route_timing_dimension_summary", window),
    callSummaryRpc(supabase, "get_admin_task_outcome_dimension_summary", window),
    measureHttpTargets(),
  ]);

  const report = {
    window,
    webVitals: summarizeWebVitals(webVitals),
    routeTiming: summarizeRouteTiming(routeTiming),
    taskOutcome: summarizeTaskOutcome(taskOutcome),
    dimensions: {
      webVitals: summarizeViewportWebVitals(viewportWebVitals),
      routeTiming: summarizeViewportRouteTiming(viewportRouteTiming),
      taskOutcome: summarizeViewportTaskOutcome(viewportTaskOutcome),
    },
    http,
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : "ADMIN_PREVIEW_PERFORMANCE_FAILED";
  console.error(`Admin Preview performance measurement failed: ${reason}`);
  process.exitCode = 1;
});
