import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server.js";

import {
  parseAdminSessionToken,
  parsePartnerSessionToken,
  parseUserSessionToken,
} from "../src/lib/session-tokens.ts";
import { proxy } from "../src/proxy.ts";

const USER_SECRET = "golden-user-session-secret-0123456789";
const ADMIN_SECRET = "golden-admin-session-secret-0123456789";
const PARTNER_SECRET = "golden-partner-session-secret-0123456789";

const GOLDEN_USER_PAYLOAD =
  '{"userId":"00000000-0000-4000-8000-000000000001","authSessionVersion":3,"authenticationMethod":"manual","mustChangePassword":false,"persistent":true,"issuedAt":1790000000000,"expiresAt":1790604800000}';
// Pinned byte-for-byte: a change here means every issued member session
// would be rejected after deploy.
const GOLDEN_USER_TOKEN =
  `${GOLDEN_USER_PAYLOAD}.609891d8d5574dc56b5358bf5be48ef46e0bfc6f9a0b7059965bd0bd2617d195`;
const GOLDEN_NOW = 1790000000000 + 60_000;
const GOLDEN_PARTNER_PAYLOAD =
  '{"accountId":"00000000-0000-4000-8000-0000000000aa","loginId":"partner@example.test","displayName":"골든 파트너","companyIds":["00000000-0000-4000-8000-0000000000bb"],"authSessionVersion":2,"mustChangePassword":false,"issuedAt":1790000000000,"expiresAt":1790604800000}';
// Pinned byte-for-byte for the partner portal cookie (UTF-8 payload).
const GOLDEN_PARTNER_TOKEN =
  `${GOLDEN_PARTNER_PAYLOAD}.3da7d92be3c3d98f93ea424a73c5af95ca6e372683e00c5683632538a804614d`;

function sign(payload: unknown, secret: string) {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(serialized).digest("hex");
  return `${serialized}.${signature}`;
}

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const ENV_NAMES = [
  "USER_SESSION_SECRET",
  "ADMIN_SESSION_SECRET",
  "PARTNER_SESSION_SECRET",
  "SELF_HOST_MODE",
  "NEXT_PUBLIC_SITE_URL",
  "ADMIN_ALLOWED_IPS",
  "ADMIN_BASIC_AUTH_USERNAME",
  "ADMIN_BASIC_AUTH_PASSWORD",
] as const;

async function withProxyEnvironment(check: () => Promise<void>) {
  const previous = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  try {
    for (const name of ENV_NAMES) delete process.env[name];
    process.env.USER_SESSION_SECRET = USER_SECRET;
    process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
    process.env.PARTNER_SESSION_SECRET = PARTNER_SECRET;
    await check();
  } finally {
    for (const name of ENV_NAMES) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

function requestWithCookies(path: string, cookies: Record<string, string>) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join("; "),
    },
  });
}

function userPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    userId: "member-1",
    authSessionVersion: 1,
    authenticationMethod: "manual",
    mustChangePassword: true,
    persistent: true,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    ...overrides,
  };
}

function partnerPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    accountId: "partner-account-1",
    loginId: "partner@example.test",
    displayName: "파트너",
    companyIds: ["company-1"],
    authSessionVersion: 2,
    mustChangePassword: false,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    ...overrides,
  };
}

function adminPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    adminId: "member-1",
    loginId: "admin",
    permissionVersion: 1,
    ...overrides,
  };
}

test("golden 회원 세션 토큰은 고정된 wire 포맷 그대로 해석된다", () => {
  assert.deepEqual(parseUserSessionToken(GOLDEN_USER_TOKEN, USER_SECRET, GOLDEN_NOW), {
    userId: "00000000-0000-4000-8000-000000000001",
    authSessionVersion: 3,
    authenticationMethod: "manual",
    issuedAt: 1790000000000,
    expiresAt: 1790604800000,
    mustChangePassword: false,
    persistent: true,
  });
  assert.equal(sign(GOLDEN_USER_PAYLOAD, USER_SECRET), GOLDEN_USER_TOKEN);
});

test("golden 파트너 세션 토큰은 고정된 wire 포맷 그대로 해석된다", () => {
  assert.deepEqual(
    parsePartnerSessionToken(GOLDEN_PARTNER_TOKEN, PARTNER_SECRET, GOLDEN_NOW),
    {
      accountId: "00000000-0000-4000-8000-0000000000aa",
      loginId: "partner@example.test",
      displayName: "골든 파트너",
      companyIds: ["00000000-0000-4000-8000-0000000000bb"],
      authSessionVersion: 2,
      mustChangePassword: false,
      issuedAt: 1790000000000,
      expiresAt: 1790604800000,
    },
  );
  assert.equal(sign(GOLDEN_PARTNER_PAYLOAD, PARTNER_SECRET), GOLDEN_PARTNER_TOKEN);
  assert.equal(parsePartnerSessionToken(GOLDEN_PARTNER_TOKEN, USER_SECRET, GOLDEN_NOW), null);
});

test("서명·수명·형식이 어긋난 회원 토큰은 같은 규칙으로 거부된다", () => {
  const [payload, signature] = [
    GOLDEN_USER_TOKEN.slice(0, GOLDEN_USER_TOKEN.lastIndexOf(".")),
    GOLDEN_USER_TOKEN.slice(GOLDEN_USER_TOKEN.lastIndexOf(".") + 1),
  ];
  const rejected = [
    `${payload}.${signature.toUpperCase()}`,
    `${payload}.${signature.slice(0, -1)}0`,
    `${payload}x.${signature}`,
    payload,
    "",
    ".",
  ];
  for (const token of rejected) {
    assert.equal(parseUserSessionToken(token, USER_SECRET, GOLDEN_NOW), null, token);
  }
  assert.equal(parseUserSessionToken(GOLDEN_USER_TOKEN, "x".repeat(40), GOLDEN_NOW), null);
  assert.equal(parseUserSessionToken(GOLDEN_USER_TOKEN, null, GOLDEN_NOW), null);
  assert.equal(parseUserSessionToken(GOLDEN_USER_TOKEN, USER_SECRET, 1790604800000), null);
  assert.equal(parseUserSessionToken(GOLDEN_USER_TOKEN, USER_SECRET, 1789999999999), null);

  const base = JSON.parse(GOLDEN_USER_PAYLOAD) as Record<string, unknown>;
  for (const broken of [
    { ...base, authSessionVersion: undefined },
    { ...base, authSessionVersion: 0 },
    { ...base, authSessionVersion: 1.5 },
    { ...base, authenticationMethod: "admin" },
    { ...base, userId: 1 },
    { ...base, persistent: "yes" },
    { ...base, policyConsentSnapshot: { serviceVersion: "1", privacyVersion: 1 } },
    [base],
  ]) {
    assert.equal(parseUserSessionToken(sign(broken, USER_SECRET), USER_SECRET, GOLDEN_NOW), null);
  }
});

test("관리자·파트너 토큰 파서는 서버 세션 모듈과 같은 필수 필드를 요구한다", () => {
  const now = Date.now();
  assert.ok(parseAdminSessionToken(sign(adminPayload(), ADMIN_SECRET), ADMIN_SECRET, now));
  assert.equal(parseAdminSessionToken(sign(adminPayload({ adminId: "" }), ADMIN_SECRET), ADMIN_SECRET, now), null);
  assert.equal(parseAdminSessionToken(sign(adminPayload({ loginId: "" }), ADMIN_SECRET), ADMIN_SECRET, now), null);
  assert.equal(parseAdminSessionToken(sign(adminPayload({ permissionVersion: "1" }), ADMIN_SECRET), ADMIN_SECRET, now), null);

  const legacyPartner = partnerPayload({ authSessionVersion: undefined });
  assert.equal(
    parsePartnerSessionToken(sign(legacyPartner, PARTNER_SECRET), PARTNER_SECRET, now)?.authSessionVersion,
    1,
  );
  for (const broken of [
    partnerPayload({ authSessionVersion: 0 }),
    partnerPayload({ authSessionVersion: "2" }),
    partnerPayload({ companyIds: [] }),
    partnerPayload({ companyIds: ["company-1", ""] }),
    partnerPayload({ mustChangePassword: "true" }),
  ]) {
    assert.equal(parsePartnerSessionToken(sign(broken, PARTNER_SECRET), PARTNER_SECRET, now), null);
  }
});

test("proxy는 서버 파서와 같은 판정으로 회원 비밀번호 변경 게이트를 적용한다", async () => {
  await withProxyEnvironment(async () => {
    const valid = sign(userPayload(), USER_SECRET);
    const gated = await proxy(requestWithCookies("/partners?page=2", { user_session: valid }));
    assert.equal(gated.status, 307);
    const location = new URL(gated.headers.get("location")!);
    assert.equal(location.pathname, "/auth/change-password");
    assert.equal(location.searchParams.get("returnTo"), "/partners?page=2");

    for (const token of [
      sign(userPayload({ authSessionVersion: undefined }), USER_SECRET),
      sign(userPayload(), "w".repeat(40)),
      sign(userPayload({ expiresAt: Date.now() - 1 }), USER_SECRET),
    ]) {
      assert.equal(parseUserSessionToken(token, USER_SECRET), null);
      const response = await proxy(requestWithCookies("/partners", { user_session: token }));
      assert.equal(response.headers.get("location"), null);
    }
  });
});

test("proxy는 서버 파서와 같은 판정으로 관리자·파트너 세션을 통과시킨다", async () => {
  await withProxyEnvironment(async () => {
    const admin = await proxy(requestWithCookies("/admin/members", {
      admin_session: sign(adminPayload(), ADMIN_SECRET),
    }));
    assert.equal(admin.headers.get("location"), null);

    const forgedAdmin = await proxy(requestWithCookies("/admin/members", {
      admin_session: sign(adminPayload({ adminId: "" }), ADMIN_SECRET),
    }));
    assert.equal(new URL(forgedAdmin.headers.get("location")!).pathname, "/auth/login");

    const partner = await proxy(requestWithCookies("/partner/reviews", {
      partner_session: sign(partnerPayload(), PARTNER_SECRET),
    }));
    assert.equal(partner.headers.get("location"), null);

    const invalidVersion = await proxy(requestWithCookies("/partner/reviews", {
      partner_session: sign(partnerPayload({ authSessionVersion: 0 }), PARTNER_SECRET),
    }));
    assert.equal(new URL(invalidVersion.headers.get("location")!).pathname, "/partner/login");
  });
});

test("proxy와 서버 세션 모듈은 같은 공용 파서를 사용하고 자체 HMAC 구현을 두지 않는다", () => {
  const proxySource = read("src/proxy.ts");
  assert.match(proxySource, /from "@\/lib\/session-tokens"/);
  assert.doesNotMatch(proxySource, /crypto\.subtle|hmacSha256Hex|function splitSignedToken/);
  assert.doesNotMatch(proxySource, /expected !== signature/);

  assert.match(read("src/lib/user-auth.ts"), /parseUserSessionToken\(token, /);
  assert.match(read("src/lib/auth.ts"), /parseSignedAdminSessionToken\(token, /);
  const partnerSessionSource = read("src/lib/partner-session.ts");
  assert.match(partnerSessionSource, /parsePartnerSessionToken\(token, /);
  assert.doesNotMatch(partnerSessionSource, /JSON\.parse|verifyHmacDigest|splitSignedToken/);
  assert.match(read("src/lib/hmac.js"), /crypto\.timingSafeEqual/);
});
