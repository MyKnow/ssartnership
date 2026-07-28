import { createClient } from "@supabase/supabase-js";
import {
  parseAdminPreviewTargetList,
  summarizeHttpSamples,
  summarizeRouteTiming,
  summarizeTaskOutcome,
  summarizeViewportRouteTiming,
  summarizeViewportTaskOutcome,
  summarizeViewportWebVitals,
  summarizeWebVitals,
  createAdminPreviewBasicAuthHeader,
  mergePreviewCookies,
} from "./admin-preview-performance-lib.mjs";

const WINDOW_DAYS = 7;
const DEFAULT_ITERATIONS = 30;
const DEFAULT_API_TARGETS = [
  { key: "admin.logs", path: "/api/admin/logs?page=1&pageSize=50&sort=newest" },
  { key: "admin.notifications", path: "/api/admin/notifications?offset=0&limit=20" },
  { key: "admin.push.recipients", path: "/api/admin/push/recipients?limit=20" },
];
const DEFAULT_PAGE_TARGETS = [
  { key: "admin.page", path: "/admin" },
  { key: "admin.members.page", path: "/admin/members" },
  { key: "admin.admins.page", path: "/admin/admins" },
  { key: "admin.tasks.page", path: "/admin/tasks" },
  { key: "admin.push.page", path: "/admin/push" },
  { key: "admin.partners.page", path: "/admin/partners" },
  { key: "admin.logs.page", path: "/admin/logs" },
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

function getSetCookieHeaders(response) {
  return typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
}

async function createFreshAdminSessionCookie(baseUrl, protectionBypass, authorization) {
  const username = process.env.ADMIN_PREVIEW_LOGIN_USERNAME?.trim();
  const password = process.env.ADMIN_PREVIEW_LOGIN_PASSWORD?.trim();
  if (!username || !password) {
    return null;
  }

  const commonHeaders = {
    Origin: baseUrl.origin,
    Referer: `${baseUrl.origin}/auth/login?returnTo=%2Fadmin`,
  };
  if (protectionBypass) {
    commonHeaders["x-vercel-protection-bypass"] = protectionBypass;
  }
  if (authorization) {
    commonHeaders.Authorization = authorization;
  }

  try {
    const loginResponse = await fetch(new URL("/api/auth/login", baseUrl), {
      method: "POST",
      redirect: "manual",
      headers: {
        ...commonHeaders,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: username,
        password,
        autoLogin: false,
      }),
    });
    const loginCookie = mergePreviewCookies("", getSetCookieHeaders(loginResponse));
    await loginResponse.arrayBuffer();
    if (loginResponse.status !== 200 || !loginCookie) {
      return null;
    }

    const sessionResponse = await fetch(
      new URL("/admin/session?returnTo=%2Fadmin", baseUrl),
      {
        redirect: "manual",
        headers: {
          ...commonHeaders,
          Accept: "text/html",
          Cookie: loginCookie,
        },
      },
    );
    const sessionCookie = mergePreviewCookies(
      loginCookie,
      getSetCookieHeaders(sessionResponse),
    );
    await sessionResponse.arrayBuffer();
    return sessionResponse.status >= 300
      && sessionResponse.status < 400
      && sessionCookie.split(";").some((cookie) => cookie.trim().startsWith("admin_session="))
      ? sessionCookie
      : null;
  } catch {
    return null;
  }
}

function parseTargets() {
  const raw = process.env.ADMIN_PREVIEW_API_TARGETS?.trim();
  return parseAdminPreviewTargetList(raw, {
    defaultTargets: DEFAULT_API_TARGETS,
    errorCode: "ADMIN_PREVIEW_API_TARGETS_INVALID",
    pathPrefix: "/api/admin/",
  });
}

function parsePageTargets() {
  const raw = process.env.ADMIN_PREVIEW_PAGE_TARGETS?.trim();
  return parseAdminPreviewTargetList(raw, {
    defaultTargets: DEFAULT_PAGE_TARGETS,
    errorCode: "ADMIN_PREVIEW_PAGE_TARGETS_INVALID",
    pathPrefix: "/admin",
  });
}

async function callSummaryRpc(supabase, functionName, window) {
  const { data, error } = await supabase.rpc(functionName, window);
  if (error) {
    throw new Error(`${functionName}_${error.code || "FAILED"}`);
  }
  return data ?? [];
}

async function measureHttpTarget(
  baseUrl,
  cookie,
  protectionBypass,
  target,
  iterations,
  accept,
  options,
  authorization,
) {
  const samples = [];
  const url = new URL(target.path, baseUrl);
  const headers = {
    Accept: accept,
    Cookie: cookie,
    Origin: url.origin,
    Referer: `${url.origin}/admin`,
  };
  if (protectionBypass) {
    headers["x-vercel-protection-bypass"] = protectionBypass;
  }
  if (authorization) {
    headers.Authorization = authorization;
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
  return { key: target.key, ...summarizeHttpSamples(samples, options) };
}

async function measureHttpTargets(targets, accept, options) {
  const baseUrl = process.env.ADMIN_PREVIEW_URL?.trim();
  const fallbackCookie = process.env.ADMIN_PREVIEW_SESSION_COOKIE?.trim();
  const protectionBypass = process.env.ADMIN_PREVIEW_PROTECTION_BYPASS?.trim();
  if (!baseUrl) {
    return {
      skipped: "ADMIN_PREVIEW_URL_MISSING",
      targets: [],
    };
  }

  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== "https:" && parsedBaseUrl.hostname !== "localhost") {
    throw new Error("ADMIN_PREVIEW_URL_INVALID");
  }

  const iterations = parsePositiveInteger(process.env.ADMIN_PREVIEW_ITERATIONS, DEFAULT_ITERATIONS);
  const authorization = createAdminPreviewBasicAuthHeader();
  const cookie = await createFreshAdminSessionCookie(
    parsedBaseUrl,
    protectionBypass,
    authorization,
  ) ?? fallbackCookie;
  if (!cookie) {
    return {
      skipped: "ADMIN_PREVIEW_SESSION_COOKIE_OR_LOGIN_MISSING",
      targets: [],
    };
  }
  const results = [];
  for (const target of targets) {
    results.push(await measureHttpTarget(
      parsedBaseUrl,
      cookie,
      protectionBypass,
      target,
      iterations,
      accept,
      options,
      authorization,
    ));
  }
  return { iterations, targets: results };
}

function measureApiTargets() {
  return measureHttpTargets(parseTargets(), "application/json");
}

function measurePageTargets() {
  return measureHttpTargets(parsePageTargets(), "text/html", {
    isSuccessful: (sample) => sample.status === 200,
  });
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
    console.log(`\nHTTP API Server-Timing: skipped (${report.http.skipped})`);
  } else {
    console.log("\nHTTP API Server-Timing p95");
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

  if (report.pages.skipped) {
    console.log(`\nHTTP page response p95: skipped (${report.pages.skipped})`);
  } else {
    console.log("\nHTTP page response p95 (authenticated HTML, status 200)");
    for (const page of report.pages.targets) {
      const statuses = Object.entries(page.statusCounts)
        .map(([status, count]) => `${status}=${count}`)
        .join(", ");
      console.log(
        `- ${page.key}: total=${page.totalP95Ms ?? "n/a"}ms, status200=${page.successCount}/${page.requestCount}, statuses=${statuses || "none"}`,
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
    pages,
  ] = await Promise.all([
    callSummaryRpc(supabase, "get_admin_web_vitals_summary", window),
    callSummaryRpc(supabase, "get_admin_route_timing_summary", window),
    callSummaryRpc(supabase, "get_admin_task_outcome_summary", window),
    callSummaryRpc(supabase, "get_admin_web_vitals_dimension_summary", window),
    callSummaryRpc(supabase, "get_admin_route_timing_dimension_summary", window),
    callSummaryRpc(supabase, "get_admin_task_outcome_dimension_summary", window),
    measureApiTargets(),
    measurePageTargets(),
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
    pages,
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
