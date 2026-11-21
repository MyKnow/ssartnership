import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server.js";

import { proxy } from "../src/proxy.ts";
import { REQUEST_PATH_HEADER } from "../src/lib/request-path.ts";

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

/** A Server Action call as the client router sends it: POST to the page URL. */
async function postServerAction(
  path: string,
  options: { mustChangePassword?: boolean; actionHeader?: boolean } = {},
) {
  const headers = new Headers({ "content-type": "text/plain;charset=UTF-8" });
  if (options.actionHeader !== false) {
    headers.set("next-action", "7f0c5a1e9b3d");
  }
  if (options.mustChangePassword !== undefined) {
    headers.set(
      "cookie",
      `partner_session=${signPartnerCookie(options.mustChangePassword)}`,
    );
  }
  return proxy(
    new NextRequest(`${origin}${path}`, { method: "POST", headers, body: "[]" }),
  );
}

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    return statSync(entryPath).isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

/**
 * Partner server action modules that do not read the partner session
 * themselves, with the reason. Every other module must, because the proxy
 * lets session-less action calls through to them.
 */
const PARTNER_ACTION_SESSION_EXCEPTIONS = new Map<string, string>([
  ["src/app/partner/login/_actions/login.ts", "로그인 전 흐름"],
  [
    "src/app/partner/services/[partnerId]/request/actions.ts",
    "세션을 확인하는 ./_actions 구현에 그대로 위임만 한다",
  ],
]);

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

describe("partner proxy server action handling", () => {
  it("lets a session-less server action reach its own session guard with the submitting screen", async () => {
    for (const screen of [
      "/partner/account?companyId=company-1",
      "/partner/companies/company-1/services/partner-1?mode=edit",
    ]) {
      const response = await postServerAction(screen);
      assert.equal(response.headers.get("location"), null, screen);
      // The guard reads this forwarded path to build the login returnTo.
      assert.equal(
        response.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`),
        screen,
        screen,
      );
    }
  });

  it("keeps redirecting page loads, plain posts and pending password changes", async () => {
    assert.equal(
      (await postServerAction("/partner/account?companyId=company-1", { actionHeader: false }))
        .headers.get("location"),
      `${origin}/partner/login?returnTo=%2Fpartner%2Faccount%3FcompanyId%3Dcompany-1`,
    );
    assert.equal(
      await visit("/partner/account?companyId=company-1"),
      `${origin}/partner/login?returnTo=%2Fpartner%2Faccount%3FcompanyId%3Dcompany-1`,
    );
    // A pending change is a policy gate, not a missing session: not every
    // partner action checks it, so the proxy still sends it to the gate.
    assert.equal(
      (await postServerAction("/partner/companies/company-1", { mustChangePassword: true }))
        .headers.get("location"),
      `${origin}/partner/change-password?returnTo=%2Fpartner%2Fcompanies%2Fcompany-1`,
    );
    assert.equal(
      (await postServerAction("/partner/companies/company-1", { mustChangePassword: false }))
        .headers.get("location"),
      null,
    );
  });

  it("relies on every partner server action module reading the partner session itself", () => {
    const actionModules = listFiles(path.join(repositoryRoot, "src/app/partner"))
      .filter((filePath) => /\.tsx?$/.test(filePath))
      .map((filePath) => ({
        path: path.relative(repositoryRoot, filePath).split(path.sep).join("/"),
        source: readFileSync(filePath, "utf8"),
      }))
      .filter((actionModule) => /^"use server";/m.test(actionModule.source));
    assert.ok(actionModules.length >= 9, String(actionModules.length));

    for (const actionModule of actionModules) {
      if (PARTNER_ACTION_SESSION_EXCEPTIONS.has(actionModule.path)) {
        continue;
      }
      const [preamble, ...handlers] = actionModule.source.split(/export async function /);
      assert.ok(handlers.length > 0, actionModule.path);
      // An action may read the session through a local helper.
      const sessionReaders = [
        "requirePartnerActionSession",
        "getPartnerSession",
        ...[
          ...preamble.matchAll(
            /async function (\w+)\([^)]*\)[^{]*\{[\s\S]*?await (?:requirePartnerActionSession|getPartnerSession)\(\)/g,
          ),
        ].map((match) => match[1]),
      ];
      for (const handler of handlers) {
        assert.ok(
          sessionReaders.some((name) => handler.includes(`${name}(`)),
          `${actionModule.path}: ${handler.slice(0, 40)} must read the partner session`,
        );
      }
    }

    const delegating = actionModules.find((actionModule) =>
      actionModule.path.endsWith("services/[partnerId]/request/actions.ts"),
    );
    assert.ok(delegating);
    const delegates = [...delegating.source.matchAll(/return (\w+)\(formData\);/g)].map(
      (match) => match[1],
    );
    assert.equal(delegates.length, 3);
    for (const delegate of delegates) {
      assert.match(
        delegating.source,
        new RegExp(`import \\{ ${delegate} \\} from "\\./_actions/\\w+";`),
        delegate,
      );
    }
  });
});
