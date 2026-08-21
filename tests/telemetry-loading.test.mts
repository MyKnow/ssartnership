import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel telemetry는 Vercel 실행 환경에서만 삽입한다", async () => {
  const layout = await readFile(
    new URL("../src/app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /process\.env\.VERCEL === "1"/);
  assert.match(layout, /shouldLoadVercelTelemetry \?/);
});
