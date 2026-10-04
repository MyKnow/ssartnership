import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import {
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  RELAY_UPSTREAM_KEEPALIVE_MS,
  SELF_HOST_TIMEZONE,
  validateRuntimeProcessDefaults,
  validateSelfHostRuntimeEnvironment,
} from "../deploy/self-host/runtime-env.mjs";
import { IMAGE_TRANSFORM_POLICIES } from "../src/lib/image-upload/policy.ts";

const require = createRequire(import.meta.url);
const { load } = require("js-yaml") as { load: (source: string) => unknown };
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const codes = (diagnostics: { code: string; subject: string }[]) => diagnostics.map(({ code, subject }) => `${code}:${subject}`);

test("optional process defaults keep Korean time and outlive the relay keepalive", () => {
  assert.equal(SELF_HOST_TIMEZONE, "Asia/Seoul");
  assert.ok(DEFAULT_KEEP_ALIVE_TIMEOUT_MS > RELAY_UPSTREAM_KEEPALIVE_MS);
  assert.deepEqual(validateRuntimeProcessDefaults({}), []);
  assert.deepEqual(validateRuntimeProcessDefaults({ TZ: "Asia/Seoul", KEEP_ALIVE_TIMEOUT: "130000" }), []);
  assert.deepEqual(codes(validateRuntimeProcessDefaults({ TZ: "UTC" })), ["runtime_timezone_invalid:TZ"]);
  for (const value of ["120000", "5000", "600001", "13e4", "-1", "130000ms"]) {
    assert.deepEqual(codes(validateRuntimeProcessDefaults({ KEEP_ALIVE_TIMEOUT: value })), ["keep_alive_timeout_invalid:KEEP_ALIVE_TIMEOUT"], value);
  }
});

test("startup validation reports an invalid process default in every self-host mode", () => {
  const manifest = {
    version: 1,
    publicEnvironment: {
      NEXT_PUBLIC_DATA_SOURCE: "mock",
      NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
    },
  };
  const environment = { ...manifest.publicEnvironment, SELF_HOST_MODE: "local-mock" };
  assert.deepEqual(validateSelfHostRuntimeEnvironment(environment, manifest), []);
  assert.deepEqual(
    codes(validateSelfHostRuntimeEnvironment({ ...environment, KEEP_ALIVE_TIMEOUT: "5000" }, manifest)),
    ["keep_alive_timeout_invalid:KEEP_ALIVE_TIMEOUT"],
  );
});

type ComposeApp = { environment: Record<string, string>; volumes?: string[] };

test("the app keep-alive outlives the relay's idle upstream connections", () => {
  const relay = read("deploy/pve/relay.Caddyfile").replace(/^\s*#.*\n/gmu, "");
  assert.match(relay, /transport http \{\s*keepalive 2m\s*\}/u);
  assert.equal(RELAY_UPSTREAM_KEEPALIVE_MS, 2 * 60 * 1000);
  assert.ok(DEFAULT_KEEP_ALIVE_TIMEOUT_MS > RELAY_UPSTREAM_KEEPALIVE_MS);
});

test("PVE app overlays pin the process defaults and persist only the Next cache", () => {
  for (const [path, prefix] of [["deploy/self-host/compose.production.yaml", "production"], ["deploy/self-host/compose.original-preview.yaml", "original"]] as const) {
    const compose = load(read(path)) as { services: { app: ComposeApp }; volumes: Record<string, unknown> };
    const app = compose.services.app;
    assert.equal(app.environment.TZ, SELF_HOST_TIMEZONE, path);
    assert.equal(app.environment.KEEP_ALIVE_TIMEOUT, String(DEFAULT_KEEP_ALIVE_TIMEOUT_MS), path);
    assert.deepEqual(validateRuntimeProcessDefaults(app.environment), [], path);
    assert.deepEqual(app.volumes, [`${prefix}-app-next-cache:/app/.next/cache`], path);
    assert.ok(Object.hasOwn(compose.volumes, `${prefix}-app-next-cache`), path);
  }
});

test("app images default to Korean time, the relay-safe keep-alive and a nextjs-owned cache", () => {
  for (const path of ["Dockerfile", "deploy/self-host-ci/App.Dockerfile"]) {
    const dockerfile = read(path);
    assert.match(dockerfile, new RegExp(`TZ=${SELF_HOST_TIMEZONE}`, "u"), path);
    assert.match(dockerfile, new RegExp(`KEEP_ALIVE_TIMEOUT=${DEFAULT_KEEP_ALIVE_TIMEOUT_MS}\\b`, "u"), path);
    const cacheDirectory = dockerfile.indexOf("install -d -o nextjs -g nextjs -m 0755 /app/.next /app/.next/cache");
    assert.ok(cacheDirectory !== -1 && cacheDirectory < dockerfile.indexOf("USER nextjs"), path);
  }
});

test("each app start drops the process-local data cache but keeps optimized images", () => {
  const start = read("deploy/self-host/start.sh");
  const reset = start.indexOf('rm -rf "$cache_dir/fetch-cache"');
  assert.match(start, /^cache_dir=\/app\/\.next\/cache$/mu);
  assert.ok(reset !== -1 && reset < start.indexOf("exec node /app/server.js"));
  assert.ok(start.indexOf("validate-runtime.mjs") < reset);
  assert.doesNotMatch(start, /cache\/images|rm -rf "\$cache_dir"\s/u);
});

function loadNextConfig(environment: Record<string, string>) {
  const code = "const {default:c}=await import('./next.config.ts'); console.log(JSON.stringify({output:c.output??null,compress:c.compress,images:c.images,optimize:c.experimental?.optimizePackageImports??null}));";
  const env = { ...process.env, SELF_HOST_BUILD: "", SELF_HOST_E2E_BUILD: "0", ...environment, NODE_ENV: "production" as const };
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd: new URL("..", import.meta.url), env, encoding: "utf8" })) as {
    output: string | null;
    compress: boolean;
    images: { minimumCacheTTL: number; deviceSizes: number[]; imageSizes: number[] };
    optimize: string[] | null;
  };
}

test("the deployable build hands compression to the edge and keeps local servers compressing", () => {
  const deployable = loadNextConfig({ SELF_HOST_BUILD: "1" });
  assert.equal(deployable.output, "standalone");
  assert.equal(deployable.compress, false);
  const local = loadNextConfig({});
  assert.equal(local.output, null);
  assert.equal(local.compress, true);
  // Next 16 already optimizes the icon entry points; a user list only duplicated it.
  assert.equal(local.optimize, null);
});

test("image optimizer sizes follow stored source widths and cache across deploys", () => {
  const { images } = loadNextConfig({ SELF_HOST_BUILD: "1" });
  assert.equal(images.minimumCacheTTL, 31 * 24 * 60 * 60);
  const largestSource = Math.max(...Object.values(IMAGE_TRANSFORM_POLICIES).map((policy) => policy.width));
  assert.equal(largestSource, 2100);
  assert.ok(Math.max(...images.deviceSizes) <= largestSource, "no device width above the largest stored source");
  assert.ok(Math.max(...images.imageSizes) < Math.min(...images.deviceSizes), "imageSizes stay below deviceSizes");
  for (const sizes of [images.deviceSizes, images.imageSizes]) {
    assert.deepEqual([...sizes].sort((left, right) => left - right), sizes);
  }
  // Fixed-width avatars and thumbnails need a 1x and 2x candidate.
  for (const width of [64, 96, 144, 160]) {
    const all = [...images.imageSizes, ...images.deviceSizes];
    assert.ok(all.some((size) => size >= width) && all.some((size) => size >= width * 2), `width ${width}`);
  }
});
