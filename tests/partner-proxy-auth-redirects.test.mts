import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server.js";

import { proxy } from "../src/proxy.ts";

/**
 * The proxy only sees the signed partner cookie, not the database. A cookie
 * can still verify after the session was revoked (password reset on another
 * device, deactivated account or company), and the protected pages then send
 * the request to `/partner/login`. Login and reset therefore must not bounce a
 * verified cookie back into the portal: those pages re-check the session
 * themselves, which keeps a revoked cookie from looping between them.
 */

const origin = "https://partner-proxy.example";
const secret = "partner-proxy-test-secret-0123456789abcdef";
const environmentKeys = [
  "PARTNER_SESSION_SECRET",
  "SELF_HOST_MODE",
  "NEXT_PUBLIC_SITE_URL",
] as const;
let previousEnvironment: Partial<Record<(typeof environmentKeys)[number], string>> = {};

beforeEach(() => {
  previousEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  process.env.PARTNER_SESSION_SECRET = secret;
  delete process.env.SELF_HOST_MODE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  for (const key of environmentKeys) {
    const value = previousEnvironment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function signPartnerCookie(mustChangePassword: boolean) {
  const now = Date.now();
  const payload = JSON.stringify({
    accountId: "account-1",
    loginId: "partner@example.com",
    displayName: "담당자",
    companyIds: ["company-1"],
    authSessionVersion: 1,
    mustChangePassword,
    issuedAt: now - 1_000,
    expiresAt: now + 60 * 60 * 1_000,
  });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return encodeURIComponent(`${payload}.${signature}`);
}

async function visit(path: string, options: { mustChangePassword?: boolean } = {}) {
  const headers =
    options.mustChangePassword === undefined
      ? undefined
      : { cookie: `partner_session=${signPartnerCookie(options.mustChangePassword)}` };
  const response = await proxy(new NextRequest(`${origin}${path}`, { headers }));
  return response.headers.get("location");
}

describe("partner proxy auth page handling", () => {
  it("lets login and reset re-check a verified cookie instead of redirecting into the portal", async () => {
    for (const mustChangePassword of [false, true]) {
      for (const path of [
        "/partner/login",
        "/partner/login?returnTo=%2Fpartner%2Fcompanies%2Fcompany-1",
        "/partner/login?error=session_expired",
        "/partner/reset",
      ]) {
        assert.equal(
          await visit(path, { mustChangePassword }),
          null,
          `${path} (mustChangePassword=${mustChangePassword})`,
        );
      }
    }
  });

  it("still sends a pending password change from portal pages to the gate with the deep link", async () => {
    assert.equal(
      await visit("/partner/companies/company-1?tab=services", { mustChangePassword: true }),
      `${origin}/partner/change-password?returnTo=%2Fpartner%2Fcompanies%2Fcompany-1%3Ftab%3Dservices`,
    );
    assert.equal(
      await visit("/partner/change-password", { mustChangePassword: true }),
      null,
    );
    assert.equal(
      await visit("/partner/companies/company-1", { mustChangePassword: false }),
      null,
    );
  });

  it("keeps the anonymous deep link redirect and the logged-in setup redirect", async () => {
    assert.equal(
      await visit("/partner/notifications?companyId=company-1"),
      `${origin}/partner/login?returnTo=%2Fpartner%2Fnotifications%3FcompanyId%3Dcompany-1`,
    );
    assert.equal(await visit("/partner/login"), null);
    assert.equal(await visit("/partner/reset"), null);
    assert.equal(
      await visit("/partner/setup/0123456789abcdef", { mustChangePassword: false }),
      `${origin}/partner`,
    );
  });
});
