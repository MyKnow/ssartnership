import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { shouldLoadSelfHostedTelemetry } from "../src/lib/telemetry-mode.ts";

test("self-host telemetry mounts only for supabase builds, never for mock builds", async () => {
  assert.equal(shouldLoadSelfHostedTelemetry({ NEXT_PUBLIC_DATA_SOURCE: "supabase" }), true);
  for (const environment of [{}, { NEXT_PUBLIC_DATA_SOURCE: "mock" }, { NEXT_PUBLIC_DATA_SOURCE: "" }]) {
    assert.equal(shouldLoadSelfHostedTelemetry(environment), false);
  }
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /shouldLoadSelfHostedTelemetry\(\{/u);
  assert.match(layout, /loadSelfHostedTelemetry \? <SelfHostedWebVitals \/> : null/u);
});

test("루트 레이아웃과 의존성에는 폐기된 Vercel 텔레메트리 분기가 없다", async () => {
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const telemetryMode = await readFile(new URL("../src/lib/telemetry-mode.ts", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

  assert.doesNotMatch(layout, /VERCEL|@vercel/u);
  assert.doesNotMatch(telemetryMode, /VERCEL/u);
  for (const name of ["@vercel/analytics", "@vercel/speed-insights"]) {
    assert.equal(packageJson.dependencies?.[name], undefined, `${name} must stay removed`);
    assert.equal(packageJson.devDependencies?.[name], undefined, `${name} must stay removed`);
  }
});
