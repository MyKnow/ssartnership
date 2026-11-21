import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyAdminPermissionMatrix } from "../src/lib/admin-permissions.ts";
import { createMcpReadService, type McpReadDependencies, type McpPrincipal } from "../src/lib/mcp/read-service.ts";
import type { AdminAccount } from "../src/lib/admin-accounts.ts";
import type { Partner } from "../src/lib/types.ts";

const id = "a2e05ecc-e1c9-4de1-b518-caec2be835ce";
const principal: McpPrincipal = { adminId: "member-1", permissionVersion: 1, scopes: ["catalog:read", "showcase:own-feedback:read"] };
function fixture() {
  const permissions = createEmptyAdminPermissionMatrix();
  permissions.brands.read = true;
  permissions.events.read = true;
  const account = { id: "member-1", isActive: true, mustChangePassword: false, permissionVersion: 1, permissionId: "super_admin", permissions } as AdminAccount;
  const partner: Partner = { id, name: "역삼 카페", category: "cafe", location: "역삼", visibility: "public", createdAt: "2026-01-01", period: { start: "2026-01-01", end: "2099-12-31" }, benefits: ["음료 할인"], conditions: ["내부 상세 조건"], appliesTo: ["student"], inquiryLink: "private", directorySearchText: "private" };
  const calls: unknown[] = [];
  const dependencies: McpReadDependencies = {
    getAdminAccount: async () => account,
    partners: {
      getPublicDirectoryPartners: async (context) => { calls.push(context); return [partner]; },
      getPartnerById: async (_id, context) => { calls.push(context); return partner; },
    },
    showcase: {
      listOwnerFeedback: async (memberId, projectId) => { calls.push({ memberId, projectId }); return [{ id: "internal-id", body: "좋은 서비스입니다." }]; },
    },
  };
  return { account, partner, calls, dependencies, service: createMcpReadService(dependencies) };
}

test("missing/revoked account, stale permission version and password gate fail before data access", async () => {
  for (const patch of [{ isActive: false }, { permissionVersion: 2 }, { mustChangePassword: true }]) {
    const f = fixture(); Object.assign(f.account, patch);
    const result = await f.service.searchPartners(principal, {});
    assert.deepEqual(result, { ok: false, code: "unauthorized" }); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); f.dependencies.getAdminAccount = async () => null;
  assert.deepEqual(await f.service.searchPartners(principal, {}), { ok: false, code: "unauthorized" });
});

test("scope AND current permission are required on every call", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.searchPartners({ ...principal, scopes: [] }, {}), { ok: false, code: "forbidden" });
  f.account.permissions.brands.read = false;
  assert.deepEqual(await f.service.searchPartners(principal, {}), { ok: false, code: "forbidden" });
  assert.equal(f.calls.length, 0);
});

test("rejects actor override, malformed ids and unbounded pages", async () => {
  const f = fixture();
  for (const input of [{ limit: 101 }, { offset: -1 }, { query: "a".repeat(121) }, { memberId: "other" }, { limit: "10" }]) {
    assert.deepEqual(await f.service.searchPartners(principal, input), { ok: false, code: "invalid_input" });
  }
  assert.deepEqual(await f.service.getPartner(principal, { partnerId: "../private" }), { ok: false, code: "invalid_input" });
  assert.deepEqual(await f.service.listOwnFeedback(principal, { projectId: id, memberId: "other" }), { ok: false, code: "invalid_input" });
  assert.equal(f.calls.length, 0);
});

test("catalog reuses repository guest visibility and allowlists output", async () => {
  const f = fixture();
  const result = await f.service.searchPartners(principal, { query: "카페" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.items.length, 1);
  assert.deepEqual(f.calls, [{ authenticated: false }]);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(JSON.stringify(result).includes("내부 상세 조건"), false);
  assert.equal(result.data.items[0].name, "역삼 카페");
  assert.deepEqual(await f.service.searchPartners(principal, { category: "health" }), { ok: true, data: { items: [], nextOffset: null } });
});

test("even an incorrect adapter cannot leak nonpublic or locked benefits", async () => {
  const f = fixture(); f.partner.visibility = "private";
  assert.deepEqual(await f.service.getPartner(principal, { partnerId: id }), { ok: false, code: "not_found" });
  const list = await f.service.searchPartners(principal, {});
  assert.deepEqual(list, { ok: true, data: { items: [], nextOffset: null } });
  f.partner.visibility = "public"; f.partner.benefitAccessStatus = "login_required";
  const result = await f.service.getPartner(principal, { partnerId: id });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data.benefits, []);
});

test("feedback ownership comes from the principal and response contains body only", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.listOwnFeedback(principal, { projectId: id }), { ok: true, data: { items: [{ body: "좋은 서비스입니다." }], nextOffset: null } });
  assert.deepEqual(f.calls, [{ memberId: "member-1", projectId: id }]);
});

test("regional admin cannot access global showcase operations", async () => {
  const f = fixture(); f.account.permissionId = "regional_partner_manager";
  assert.deepEqual(await f.service.listOwnFeedback(principal, { projectId: id }), { ok: false, code: "forbidden" });
  assert.equal(f.calls.length, 0);
});

test("read failures return safe errors without raw provider messages", async () => {
  const f = fixture();
  f.dependencies.partners.getPublicDirectoryPartners = async () => { throw new Error("credential=secret"); };
  assert.deepEqual(await f.service.searchPartners(principal, {}), { ok: false, code: "unavailable" });
  f.dependencies.getAdminAccount = async () => { throw new Error("secret account lookup"); };
  assert.deepEqual(await f.service.getPartner(principal, { partnerId: id }), { ok: false, code: "unavailable" });
});

test("page bounds are stable and permission/account is reread after each request", async () => {
  const f = fixture();
  f.dependencies.showcase.listOwnerFeedback = async () => Array.from({ length: 4 }, (_, index) => ({ id: String(index), body: String(index) }));
  assert.deepEqual(await f.service.listOwnFeedback(principal, { projectId: id, limit: 2 }), { ok: true, data: { items: [{ body: "0" }, { body: "1" }], nextOffset: 2 } });
  assert.deepEqual(await f.service.listOwnFeedback(principal, { projectId: id, limit: 2, offset: 2 }), { ok: true, data: { items: [{ body: "2" }, { body: "3" }], nextOffset: null } });
  f.account.isActive = false;
  assert.deepEqual(await f.service.listOwnFeedback(principal, { projectId: id }), { ok: false, code: "unauthorized" });
});


test("owner feedback uses the real mock Repository ownership and hidden-row rules", async () => {
  const { MockProjectShowcaseRepository, resetProjectShowcaseMockStore } = await import("../src/lib/project-showcase/repository.mock.ts");
  const store = resetProjectShowcaseMockStore();
  store.projects[0].id = id;
  store.projects[0].ownerMemberId = principal.adminId;
  store.feedback.push(
    { id: "visible", projectId: id, memberId: "author-1", body: "공개 리뷰 본문입니다.", createdAt: "2026-01-01", hiddenAt: null },
    { id: "hidden", projectId: id, memberId: "author-2", body: "숨김 본문", createdAt: "2026-01-01", hiddenAt: "2026-01-02" },
  );
  const f = fixture(); f.dependencies.showcase = new MockProjectShowcaseRepository();
  const service = createMcpReadService(f.dependencies);
  assert.deepEqual(await service.listOwnFeedback(principal, { projectId: id }), { ok: true, data: { items: [{ body: "공개 리뷰 본문입니다." }], nextOffset: null } });
  store.projects[0].ownerMemberId = "other-owner";
  assert.deepEqual(await service.listOwnFeedback(principal, { projectId: id }), { ok: true, data: { items: [], nextOffset: null } });
  resetProjectShowcaseMockStore();
});

test("DTO callers cannot mutate cached repository arrays", async () => {
  const f = fixture(); const result = await f.service.getPartner(principal, { partnerId: id });
  assert.equal(result.ok, true);
  if (result.ok) { result.data.benefits.push("changed"); result.data.appliesTo.length = 0; }
  assert.deepEqual(f.partner.benefits, ["음료 할인"]);
  assert.deepEqual(f.partner.appliesTo, ["student"]);
});


test("server adapter uses existing mock repositories and uncached admin snapshot", async () => {
  const keys = ["NODE_ENV", "NEXT_PUBLIC_DATA_SOURCE", "E2E_ADMIN_AUTH", "E2E_MOCK_MUTATIONS"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "test", NEXT_PUBLIC_DATA_SOURCE: "mock", E2E_ADMIN_AUTH: "1", E2E_MOCK_MUTATIONS: "1" });
  try {
    const { mcpReadService } = await import("../src/lib/mcp/read-service.server.ts");
    const { MOCK_MEMBER_ID } = await import("../src/lib/mock/member.ts");
    const actor = { ...principal, adminId: MOCK_MEMBER_ID };
    const list = await mcpReadService.searchPartners(actor, {});
    assert.equal(list.ok, true);
    if (!list.ok) return;
    assert.ok(list.data.items.length > 0);
    const detail = await mcpReadService.getPartner(actor, { partnerId: list.data.items[0].id });
    assert.equal(detail.ok, true);
    const stale = await mcpReadService.searchPartners({ ...actor, permissionVersion: 2 }, {});
    assert.deepEqual(stale, { ok: false, code: "unauthorized" });
  } finally {
    for (const key of keys) { if (previous[key] === undefined) Reflect.deleteProperty(process.env, key); else Reflect.set(process.env, key, previous[key]); }
  }
});
