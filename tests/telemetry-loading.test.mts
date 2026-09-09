import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { shouldLoadSelfHostedTelemetry } from "../src/lib/telemetry-mode.ts";

test("self-host telemetry never mounts in mock or Vercel environments", async () => {
  assert.equal(shouldLoadSelfHostedTelemetry({ NEXT_PUBLIC_DATA_SOURCE: "supabase" }), true);
  for (const environment of [{}, { NEXT_PUBLIC_DATA_SOURCE: "mock" }, { VERCEL: "1", NEXT_PUBLIC_DATA_SOURCE: "supabase" }]) {
    assert.equal(shouldLoadSelfHostedTelemetry(environment), false);
  }
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /shouldLoadSelfHostedTelemetry\(\{/u);
  assert.match(layout, /loadSelfHostedTelemetry \? <SelfHostedWebVitals \/> : null/u);
});

test("Vercel telemetry는 Vercel 실행 환경에서만 삽입한다", async () => {
  const layout = await readFile(
    new URL("../src/app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /process\.env\.VERCEL === "1"/);
  assert.match(layout, /shouldLoadVercelTelemetry \?/);
});
