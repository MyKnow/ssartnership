import assert from "node:assert/strict";
import test from "node:test";
import { getTrustedRequestOrigin, isTrustedSameOriginRequest } from "../src/lib/request-guards.ts";

test("self-host CSRF uses pinned public origin despite standalone internal nextUrl", () => {
  const previousMode = process.env.SELF_HOST_MODE;
  const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.SELF_HOST_MODE = "real";
    process.env.NEXT_PUBLIC_SITE_URL = "https://ssartnership.test";
    const headers = new Headers({ origin: "https://ssartnership.test", host: "attacker.test", "x-forwarded-host": "attacker.test", "content-type": "application/json" });
    const request = { url: "http://0.0.0.0:3000/api/events/product", headers };
    assert.equal(isTrustedSameOriginRequest(request, { expectedOrigin: "http://0.0.0.0:3000", allowedContentTypes: ["application/json"] }), true);
    headers.set("origin", "https://attacker.test");
    assert.equal(isTrustedSameOriginRequest(request), false);
    headers.delete("origin");
    headers.set("referer", "https://attacker.test/page");
    assert.equal(isTrustedSameOriginRequest(request), false);
    for (const origin of ["", "https://user:pass@ssartnership.test", "https://ssartnership.test/path", "http://public.test", "https://ssartnership.test?token=x"]) {
      process.env.NEXT_PUBLIC_SITE_URL = origin;
      assert.equal(getTrustedRequestOrigin("https://attacker.test"), null);
    }
    process.env.SELF_HOST_MODE = "local-mock";
    assert.equal(getTrustedRequestOrigin("http://localhost:3100"), "http://localhost:3100");
  } finally {
    if (previousMode === undefined) delete process.env.SELF_HOST_MODE; else process.env.SELF_HOST_MODE = previousMode;
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
  }
});
