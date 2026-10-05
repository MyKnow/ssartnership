import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { hasCompleteRuntimeVitalReceipt, isExpectedRuntimeRequestFailure, observeNativeVitalFetch } from "./self-host-runtime-failures.mjs";

// This fixture targets only the synthetic local Docker app. It never accepts
// an external origin or Production credentials.
const origin = "http://127.0.0.1:3100";
const output = path.resolve(".tmp/self-host/qa");
function acceptedCounts() {
  const raw = execFileSync("docker", ["exec", "ssartnership-local-telemetry-1", "node", "--input-type=module", "-e", "process.stdout.write(await (await fetch('http://127.0.0.1:9464/metrics')).text())"], { encoding: "utf8", timeout: 5000 });
  return Object.fromEntries(["LCP", "INP", "CLS"].map((name) => [name, Number(raw.match(new RegExp(`ssartnership_web_vital_count\\{name="${name}",route="auth"\\} (\\d+)`))?.[1] ?? 0)]));
}
function readVitalSample(request) {
  if (request.url() !== `${origin}/api/web-vitals` || request.method() !== "POST") return null;
  try { return request.postDataJSON(); } catch { return null; }
}
await mkdir(output, { recursive: true, mode: 0o700 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [width, height] of [[360, 844], [820, 1180], [1366, 900]]) {
    const baseline = acceptedCounts();
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const samples = [];
    const fetchObservations = [];
    const observationMarker = "SYNTHETIC_VITAL_FETCH:";
    await page.addInitScript(observeNativeVitalFetch, { marker: observationMarker });
    const errors = [];
    const failedRequests = [];
    const statuses = [];
    let leaving = false;
    page.on("pageerror", () => errors.push("pageerror"));
    page.on("console", (message) => {
      if (message.type() === "debug" && message.text().startsWith(observationMarker)) {
        try { fetchObservations.push(JSON.parse(message.text().slice(observationMarker.length))); } catch { /* Missing proof fails closed below. */ }
      }
      if (message.type() === "error") {
        const location = message.location().url;
        const routeClass = ["/api/events/product", "/api/web-vitals", "/api/image", "/_next/image", "/admin"].find((route) => location.startsWith(`${origin}${route}`)) ?? "other";
        errors.push({ kind: "console-error", resourceStatus: message.text().match(/status of (\d{3})/u)?.[1] ?? null, location: location.startsWith(origin) ? "local" : "external", routeClass });
      }
    });
    context.on("requestfailed", (request) => {
      if (request.url().startsWith(origin)) {
        const routeClass = ["/api/events/product", "/api/web-vitals", "/api/image", "/_next/image", "/auth", "/partner", "/admin"].find((route) => request.url().startsWith(`${origin}${route}`)) ?? "other";
        failedRequests.push({ url: request.url(), method: request.method(), sample: readVitalSample(request), type: request.resourceType(), routeClass, aborted: request.failure()?.errorText === "net::ERR_ABORTED", prefetch: request.headers()["next-router-prefetch"] === "1", leaving });
      }
    });
    context.on("request", (request) => {
      if (request.url() === `${origin}/api/web-vitals` && request.method() === "POST") {
        // A native call/request event is only an attempt. Receipt is checked below.
        samples.push(readVitalSample(request));
      }
    });
    context.on("response", (response) => {
      if (response.url() === `${origin}/api/web-vitals` && response.request().method() === "POST") statuses.push(response.status());
    });
    const response = await page.goto(`${origin}/auth/login?returnTo=%2Fprivate-fixture-id`);
    assert.equal(response.status(), 200);
    await expect(page.getByRole("textbox", { name: "Mattermost 아이디" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, `auth-${width}.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const config = await page.request.get(`${origin}/api/web-vitals`);
    assert.deepEqual(await config.json(), { enabled: true, sampleRate: 1 });
    // A real keyboard interaction contributes INP. Page hiding finalizes
    // the default web-vitals reporters (including LCP) and starts keepalive fetches.
    const search = page.getByRole("textbox", { name: "Mattermost 아이디" });
    await search.focus();
    await page.keyboard.type("synthetic");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForLoadState("networkidle");
    leaving = true;
    await page.goto("about:blank");
    let collectorDeltas = {};
    const evidence = () => ({ origin, collectorDeltas, samples, fetchObservations, responseStatuses: statuses });
    try {
      await expect.poll(() => {
        const counts = acceptedCounts();
        collectorDeltas = Object.fromEntries(["LCP", "INP", "CLS"].map((name) => [name, counts[name] - baseline[name]]));
        return hasCompleteRuntimeVitalReceipt(evidence());
      }, { timeout: 10_000 }).toBe(true);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ width, samples, statuses, collectorDeltas, fetchObservations, errors, failedRequests })}\n`);
      throw error;
    }
    // Only matching native keepalive attempts with complete isolated collector
    // receipt may classify teardown aborts as expected. Other fetch failures stay errors.
    const unexpectedFailures = failedRequests.filter((item) => !isExpectedRuntimeRequestFailure(item, evidence()));
    if (errors.length || unexpectedFailures.length) process.stdout.write(`${JSON.stringify({ width, errors, unexpectedFailures })}\n`);
    assert.equal(errors.length, 0);
    assert.equal(unexpectedFailures.length, 0);
    process.stdout.write(`${JSON.stringify({ width, vitals: ["CLS", "INP", "LCP"], acceptedAtCollector: true, errors: errors.length, failedRequests: unexpectedFailures.length, prefetchCancellations: failedRequests.filter((item) => item.prefetch).length, receivedKeepaliveCancellations: failedRequests.filter((item) => !item.prefetch && isExpectedRuntimeRequestFailure(item, evidence())).length })}\n`);
    await context.close();
  }
} finally { await browser.close(); }
