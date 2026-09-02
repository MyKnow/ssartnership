import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("partner auth route body helper converts malformed JSON into a recoverable 400 error", async () => {
  const helper = await read("src/lib/partner-auth/route-body.ts");

  assert.match(helper, /class PartnerPortalRouteBodyError extends Error/);
  assert.match(helper, /MAX_PARTNER_PORTAL_JSON_BODY_BYTES = 4 \* 1024/);
  assert.match(helper, /readJsonRequestBodyWithinLimit/);
  assert.match(helper, /JsonRequestBodyError/);
  assert.match(helper, /readonly status: 400 \| 413/);
  assert.match(helper, /error\.code === "body_too_large" \? 413 : 400/);
  assert.match(helper, /throw new PartnerPortalRouteBodyError\(\)/);
});

test("partner reset, change, setup routes handle malformed JSON as invalid_body", async () => {
  const [resetRoute, changeRoute, setupRoute] = await Promise.all([
    read("src/app/api/partner/reset-password/route.ts"),
    read("src/app/api/partner/change-password/route.ts"),
    read("src/app/api/partner/setup/[token]/route.ts"),
  ]);

  for (const source of [resetRoute, changeRoute, setupRoute]) {
    assert.match(source, /readPartnerPortalJsonBody/);
    assert.match(source, /error instanceof PartnerPortalRouteBodyError/);
    assert.match(source, /error:\s*"invalid_body"/);
    assert.match(source, /status:\s*400/);
  }
});
