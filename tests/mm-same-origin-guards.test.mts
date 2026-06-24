import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardedMmRoutes = [
  "src/app/api/mm/login/route.ts",
  "src/app/api/mm/change-password/route.ts",
  "src/app/api/mm/consent/route.ts",
  "src/app/api/mm/delete/route.ts",
  "src/app/api/mm/logout/route.ts",
  "src/app/api/mm/profile-sync/route.ts",
  "src/app/api/mm/_shared/reset-password-complete.ts",
] as const;

test("MM cookie and account mutation routes enforce same-origin requests", async () => {
  for (const routePath of guardedMmRoutes) {
    const source = await readFile(new URL(`../${routePath}`, import.meta.url), "utf8");
    assert.match(source, /isTrustedSameOriginRequest/, routePath);
    assert.match(source, /invalid_request|untrusted_origin/, routePath);
  }
});

test("JSON MM mutation routes also enforce content-type", async () => {
  for (const routePath of [
    "src/app/api/mm/login/route.ts",
    "src/app/api/mm/change-password/route.ts",
    "src/app/api/mm/consent/route.ts",
    "src/app/api/mm/_shared/reset-password-complete.ts",
  ]) {
    const source = await readFile(new URL(`../${routePath}`, import.meta.url), "utf8");
    assert.match(source, /allowedContentTypes: \["application\/json"\]/, routePath);
  }
});
