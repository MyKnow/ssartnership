import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server.js";
import { buildTrustedRedirectUrl } from "../src/lib/request-guards.ts";
import { proxy } from "../src/proxy.ts";

const publicOrigin = "https://ssartnership-dev.myknow.xyz";
function withEnvironment(mode: string | undefined, origin: string | undefined, check: () => void) {
  const previous = { mode: process.env.SELF_HOST_MODE, origin: process.env.NEXT_PUBLIC_SITE_URL };
  try {
    if (mode === undefined) delete process.env.SELF_HOST_MODE; else process.env.SELF_HOST_MODE = mode;
    if (origin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = origin;
    check();
  } finally {
    if (previous.mode === undefined) delete process.env.SELF_HOST_MODE; else process.env.SELF_HOST_MODE = previous.mode;
    if (previous.origin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = previous.origin;
  }
}

test("self-host redirects replace only the internal request origin and preserve destination/query", () => {
  withEnvironment("real", publicOrigin, () => {
    for (const requestUrl of ["https://0.0.0.0:3000/admin/session", "http://app:3000/partner/logout", "https://untrusted.example/path"]) {
      assert.equal(buildTrustedRedirectUrl("/auth/login?returnTo=%2Fadmin%2Fmembers%3Fpage%3D2", requestUrl).href,
        publicOrigin + "/auth/login?returnTo=%2Fadmin%2Fmembers%3Fpage%3D2");
      assert.equal(buildTrustedRedirectUrl("/partner/login", requestUrl).href, publicOrigin + "/partner/login");
    }
  });
});

test("self-host redirects fail closed on missing or unsafe operator origins", () => {
  for (const origin of [undefined, "", "https://user:secret@example.com", "https://example.com/path", "https://example.com?x=1", "http://example.com", "javascript:alert(1)"]) {
    withEnvironment("real", origin, () => assert.throws(() => buildTrustedRedirectUrl("/auth/login", "http://app:3000"), /REDIRECT_ORIGIN_INVALID/));
  }
});

test("redirect builder rejects unsafe destinations even if the caller forgot to sanitize", () => {
  withEnvironment("real", publicOrigin, () => {
    for (const target of ["https://evil.example", "//evil.example", "/\\evil.example", "auth/login", "/auth\nlogin", ""]) {
      assert.throws(() => buildTrustedRedirectUrl(target, "http://app:3000"), /REDIRECT_DESTINATION_INVALID/);
    }
  });
});

test("non-self-host redirects retain the existing Vercel and loopback origins", () => {
  withEnvironment(undefined, publicOrigin, () => {
    for (const origin of ["https://preview.vercel.app", "https://ssartnership.myknow.xyz", "http://localhost:3150"]) {
      assert.equal(buildTrustedRedirectUrl("/auth/consent?returnTo=%2Fpartners%3Fq%3Dtest", origin + "/auth/login").href,
        origin + "/auth/consent?returnTo=%2Fpartners%3Fq%3Dtest");
    }
  });
  withEnvironment(undefined, undefined, () => {
    assert.throws(() => buildTrustedRedirectUrl("/auth/login", "javascript:alert(1)"), /REDIRECT_ORIGIN_INVALID/);
  });
});

test("actual Next proxy redirects use the public origin and preserve protected route context", async () => {
  const names = ["SELF_HOST_MODE", "NEXT_PUBLIC_SITE_URL", "ADMIN_BASIC_AUTH_USERNAME", "ADMIN_BASIC_AUTH_PASSWORD", "ADMIN_ALLOWED_IPS"];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.SELF_HOST_MODE = "real";
    process.env.NEXT_PUBLIC_SITE_URL = publicOrigin;
    for (const name of names.slice(2)) delete process.env[name];
    const request = new NextRequest("https://0.0.0.0:3000/admin/members?page=2", { headers: { host: "evil.example", "x-forwarded-host": "evil.example" } });
    const response = await proxy(request);
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin, publicOrigin);
    assert.equal(location.pathname, "/auth/login");
    assert.equal(location.searchParams.get("returnTo"), "/admin/members?page=2");
    const partner = await proxy(new NextRequest("https://0.0.0.0:3000/partner/reviews?page=2"));
    assert.equal(partner.headers.get("location"), publicOrigin + "/partner/login?page=2");
  } finally {
    for (const name of names) { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; }
  }
});

test("real authentication redirect boundaries never use the standalone URL directly", async () => {
  for (const relative of ["../src/proxy.ts", "../src/app/admin/session/route.ts", "../src/app/partner/logout/route.ts"]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /buildTrustedRedirectUrl/);
    assert.doesNotMatch(source, /new URL\([^\n]*request\.url\)|request\.nextUrl\.clone\(\)/);
  }
});
