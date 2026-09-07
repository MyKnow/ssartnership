import { readFile } from "node:fs/promises";
import { parseBatch } from "./batch-plan.mjs";

export const READ_ONLY_ROUTES = Object.freeze([
  "/auth/login", "/auth/member/setup", "/api/e2e/mock/reset", "/partners/health-001",
  "/auth/signup", "/auth/signup/graduate", "/auth/graduate/setup", "/auth/reset", "/auth/reset/complete",
  "/partner/login", "/partner/reset", "/partner/setup", "/partner/setup/mock-partner-setup-cafe-ssafy",
  "/partner-registration", "/suggest", "/support/bug-report", "/campuses/seoul", "/events/signup-reward", "/legal/service", "/verify/invalid-token",
  "/certification", "/certification/photo", "/coupons", "/notifications",
  "/partner/companies/mock-partner-company-cafe-ssafy", "/partner/services/mock-partner-service-cafe-ssafy-yeoksam",
  "/partner/services/mock-partner-service-cafe-ssafy-yeoksam/request",
  "/partner/companies/mock-partner-company-urban-gym",
  "/partner/companies/mock-partner-company-urban-gym/services/mock-partner-service-urban-gym-pt",
  "/", "/legal/privacy", "/legal/marketing", "/auth/change-password", "/auth/consent", "/partner/change-password",
  "/partner", "/partner/account", "/partner/notifications", "/partner/plans", "/partner/support",
]);
export async function prepareReadOnlyModules(fetcher = fetch, report = console.log, routes = READ_ONLY_ROUTES) {
  if (!Array.isArray(routes) || !routes.length || routes.length > READ_ONLY_ROUTES.length || new Set(routes).size !== routes.length || routes.some((route) => !READ_ONLY_ROUTES.includes(route))) throw new Error("CI_WARMUP_ROUTES_INVALID");
  const deadline = Date.now() + 8 * 60_000;
  // Dev compiler preparation is separate from the unchanged behavior budget.
  // This finite reviewed list never follows redirects, posts a reset, creates
  // a domain entity or calls a cron/integration endpoint. No retry is present.
  for (const [index, route] of routes.entries()) {
    const started = Date.now();
    const remaining = deadline - started;
    if (remaining <= 0) throw new Error("CI_WARMUP_DEADLINE");
    const response = await fetcher(`http://127.0.0.1:3100${route}`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(Math.min(90_000, remaining)) });
    await response.arrayBuffer();
    const expected = route === "/api/e2e/mock/reset" ? [405] : [200, 302, 303, 307, 308];
    if (!expected.includes(response.status)) throw new Error("CI_WARMUP_FAILED");
    report(JSON.stringify({ phase: "cold-module-setup", moduleIndex: index, status: response.status, durationMs: Date.now() - started }));
  }
}
export async function prepareAdminModule(context, route) {
  const origin = "http://localhost:3100";
  const allowed = new Set(["/auth/mock", "/admin", "/admin/session", "/admin/members", "/admin/partner-registrations"]);
  let target = new URL(route, origin);
  const deadline = Date.now() + 90_000;
  for (let hop = 0; hop < 6; hop++) {
    if (target.origin !== origin || target.username || target.password || !allowed.has(target.pathname)) throw new Error("CI_ADMIN_REDIRECT_INVALID");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("CI_ADMIN_SETUP_DEADLINE");
    const response = await context.get(target.href, { timeout: remaining, maxRetries: 0, maxRedirects: 0 });
    await response.body();
    if (response.status() === 200) return;
    const location = response.headers().location;
    if (![302, 303, 307, 308].includes(response.status()) || !location) throw new Error("CI_ADMIN_SETUP_FAILED");
    target = new URL(location, target);
  }
  throw new Error("CI_ADMIN_REDIRECT_LIMIT");
}
export default async function warmup(config) {
  const batch = parseBatch(process.env.SELF_HOST_CI_E2E_BATCH);
  const plan = JSON.parse(await readFile(`/work/.self-host-build/e2e/batch-${batch}/plan.json`, "utf8"));
  if (plan.version !== 1 || typeof plan.administrator !== "boolean") throw new Error("CI_E2E_PLAN_INVALID");
  await prepareReadOnlyModules(fetch, console.log, plan.routes);
  if (!plan.administrator) return;
  // Only the standard local mock administrator fixture creates a disposable
  // session here. No real login, DB, secret or domain mutation is performed.
  const { request } = await import("/work/node_modules/playwright/index.mjs");
  const admin = config.projects.find((project) => project.name === "admin-chromium");
  if (admin?.use?.baseURL !== "http://localhost:3100") throw new Error("CI_ADMIN_SETUP_INVALID");
  const context = await request.newContext({ baseURL: admin.use.baseURL, httpCredentials: admin.use.httpCredentials,
    extraHTTPHeaders: { ...admin.use.extraHTTPHeaders, Origin: admin.use.baseURL } });
  try {
    for (const [index, route] of ["/auth/mock?returnTo=%2Fadmin", "/admin/members", "/admin/partner-registrations"].entries()) {
      const started = Date.now();
      await prepareAdminModule(context, route);
      console.log(JSON.stringify({ phase: "mock-admin-module-setup", moduleIndex: index, durationMs: Date.now() - started }));
    }
  } finally { await context.dispose(); }
}
