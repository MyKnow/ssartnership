import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach } from "node:test";

import type { PartnerSession } from "../src/lib/partner-session.ts";

process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE = "mock";

const accessModulePromise = import(
  new URL("../src/lib/partner-session-access.ts", import.meta.url).href
);
const mockStoreModulePromise = import(
  new URL("../src/lib/mock/partner-portal/store.ts", import.meta.url).href
);

function createSession(overrides: Partial<PartnerSession> = {}): PartnerSession {
  return {
    accountId: "mock-partner-account-cafe-ssafy",
    loginId: "partner@cafessafy.example",
    displayName: "김도연",
    companyIds: ["stale-company-id"],
    mustChangePassword: false,
    issuedAt: Date.now() - 1_000,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

beforeEach(async () => {
  const { resetMockPartnerPortalStore } = await mockStoreModulePromise;
  resetMockPartnerPortalStore();
});

test("partner sessions replace signed company ids with the current active mock links", async () => {
  const { revalidatePartnerSessionAccess } = await accessModulePromise;

  const result = await revalidatePartnerSessionAccess(createSession());

  assert.deepEqual(result?.companyIds, [
    "mock-partner-company-cafe-ssafy",
    "mock-partner-company-urban-gym",
  ]);
  assert.equal(result?.accountId, "mock-partner-account-cafe-ssafy");
});

test("partner sessions fail closed when the current mock account is inactive", async () => {
  const { revalidatePartnerSessionAccess } = await accessModulePromise;
  const { findMockPartnerPortalAccountById } = await mockStoreModulePromise;
  const setup = findMockPartnerPortalAccountById(
    "mock-partner-account-cafe-ssafy",
  );
  assert.ok(setup);
  setup.account.isActive = false;

  assert.equal(await revalidatePartnerSessionAccess(createSession()), null);
});

test("partner sessions fail closed when every current mock company link is revoked", async () => {
  const { revalidatePartnerSessionAccess } = await accessModulePromise;
  const { findMockPartnerPortalAccountById } = await mockStoreModulePromise;
  const setup = findMockPartnerPortalAccountById(
    "mock-partner-account-cafe-ssafy",
  );
  assert.ok(setup);
  setup.account.linkedCompanyIds = [];

  assert.equal(await revalidatePartnerSessionAccess(createSession()), null);
});

test("partner sessions fail closed when the access lookup errors", async () => {
  const { revalidatePartnerSessionAccess } = await accessModulePromise;

  const result = await revalidatePartnerSessionAccess(
    createSession(),
    async () => {
      throw new Error("database unavailable");
    },
  );

  assert.equal(result, null);
});

test("partner sessions reject inactive or empty access snapshots", async () => {
  const { revalidatePartnerSessionAccess } = await accessModulePromise;
  const session = createSession();

  assert.equal(
    await revalidatePartnerSessionAccess(session, async () => ({
      isActive: false,
      companyIds: ["company-a"],
    })),
    null,
  );
  assert.equal(
    await revalidatePartnerSessionAccess(session, async () => ({
      isActive: true,
      companyIds: [],
    })),
    null,
  );
});

test("getPartnerSession revalidates access while the raw signed-session API remains available", () => {
  const source = readFileSync(
    new URL("../src/lib/partner-session.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /export async function getSignedPartnerSession\(\)/);
  assert.match(source, /import \{ cache \} from "react"/);
  assert.match(source, /export const getPartnerSession = cache\(async \(\) => \{/);
  assert.match(source, /await getSignedPartnerSession\(\)/);
  assert.match(source, /revalidatePartnerSessionAccess\(/);
});

test("the Supabase access lookup requires active accounts, links, and companies", () => {
  const source = readFileSync(
    new URL("../src/lib/partner-session-access.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /from\("partner_accounts"\)[\s\S]*?\.eq\("is_active", true\)/,
  );
  assert.match(
    source,
    /from\("partner_account_companies"\)[\s\S]*?\.eq\("is_active", true\)/,
  );
  assert.match(source, /partner_companies!inner\(id,is_active\)/);
  assert.match(source, /\.eq\("company\.is_active", true\)/);
  assert.match(source, /company\?\.is_active === true/);
});
