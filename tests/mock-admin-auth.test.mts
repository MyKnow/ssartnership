import assert from "node:assert/strict";
import test from "node:test";
import {
  getMockAdminAccountById,
  isMockAdminAuthEnabled,
} from "../src/lib/mock/admin.ts";
import { MOCK_MEMBER_ID } from "../src/lib/mock/member.ts";

test("mock admin auth requires explicit non-production E2E flags", () => {
  const environment = {
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    E2E_ADMIN_AUTH: "1",
    E2E_MOCK_MUTATIONS: "1",
  };

  assert.equal(isMockAdminAuthEnabled(environment), true);
  assert.equal(
    isMockAdminAuthEnabled({ ...environment, NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    isMockAdminAuthEnabled({ ...environment, E2E_MOCK_MUTATIONS: "0" }),
    false,
  );
  assert.equal(
    isMockAdminAuthEnabled({ ...environment, NEXT_PUBLIC_DATA_SOURCE: "supabase" }),
    false,
  );
});

test("mock admin auth exposes only the deterministic synthetic administrator", () => {
  const environment = {
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    E2E_ADMIN_AUTH: "1",
    E2E_MOCK_MUTATIONS: "1",
  };

  const account = getMockAdminAccountById(MOCK_MEMBER_ID, environment);
  assert.equal(account?.id, MOCK_MEMBER_ID);
  assert.equal(account?.loginId, "e2e-admin");
  assert.equal(account?.permissionId, "super_admin");
  assert.equal(account?.isActive, true);
  assert.equal(account?.mustChangePassword, false);
  assert.equal(getMockAdminAccountById("not-the-mock-member", environment), null);
});
