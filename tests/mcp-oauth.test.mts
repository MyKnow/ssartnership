import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMcpOAuthService, pkceChallenge, hashCredential, McpOAuthError } from "../src/lib/mcp/oauth/service.ts";
import { MockMcpOAuthRepository } from "../src/lib/mcp/oauth/repository.mock.ts";
import { createEmptyAdminPermissionMatrix } from "../src/lib/admin-permissions.ts";
import type { AdminAccount } from "../src/lib/admin-accounts.ts";

function fixture() {
  let clock = Date.now(); const permissions = createEmptyAdminPermissionMatrix();
  permissions.brands.read = true; permissions.events.read = true; permissions.events.update = true; permissions.admin_management.create = true;
  const account = { id: "owner", isActive: true, permissionVersion: 1, permissionId: "super_admin", mustChangePassword: false, permissions } as AdminAccount;
  const repository = new MockMcpOAuthRepository(undefined, () => clock);
  const resource = "https://service.example/api/mcp";
  const service = createMcpOAuthService({ repository, resource, getAdminAccount: async () => account, now: () => clock });
  const verifier = "v".repeat(64);
  async function authorize() {
    const client = await service.registerClient(account.id, { name: "Test client", redirectUri: "https://client.example/callback" });
    const request = { client_id: client.id, redirect_uri: client.redirectUri, response_type: "code" as const, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" as const, resource, scope: "catalog:read" };
    const code = await service.authorize(account.id, request, randomUUID());
    const exchange = { grant_type: "authorization_code", client_id: client.id, redirect_uri: client.redirectUri, code, code_verifier: verifier, resource };
    return { client, request, code, exchange };
  }
  return { service, repository, account, authorize, resource, advance: (ms: number) => { clock += ms; } };
}
const fails = (code: string) => (error: unknown) => error instanceof McpOAuthError && error.code === code;

test("authorization uses exact registered callbacks, S256 and resource; rejects scope escalation", async () => {
  const f = fixture(), a = await f.authorize();
  for (const patch of [{ redirect_uri: "https://evil.example/callback" }, { client_id: randomUUID() }]) {
    await assert.rejects(() => f.service.validateAuthorization({ ...a.request, ...patch }), fails("invalid_client"));
  }
  for (const patch of [{ code_challenge_method: "plain" }, { resource: "https://other.example/api/mcp" }, { memberId: "other" }]) {
    await assert.rejects(() => f.service.validateAuthorization({ ...a.request, ...patch }), fails("invalid_request"));
  }
  await assert.rejects(() => f.service.validateAuthorization({ ...a.request, scope: "db:all" }), fails("invalid_scope"));
  assert.equal((await f.service.validateAuthorization({...a.request,resource:[f.resource,f.resource]})).value.resource,f.resource);
  for(const patch of [{resource:[f.resource,"https://other.example/api/mcp"]},{resource:Array(9).fill(f.resource)},{client_id:[a.client.id,a.client.id]}]) await assert.rejects(()=>f.service.validateAuthorization({...a.request,...patch}),fails("invalid_request"));
  await assert.rejects(() => f.service.registerClient("owner", { name: "bad", redirectUri: "javascript:alert(1)" }), fails("invalid_request"));
});

test("PKCE mismatch never consumes code; concurrent exchange is single use", async () => {
  const f = fixture(), a = await f.authorize();
  await assert.rejects(() => f.service.exchange({ ...a.exchange, code_verifier: "wrong".repeat(12) }), fails("invalid_grant"));
  const outcomes = await Promise.allSettled([f.service.exchange(a.exchange), f.service.exchange(a.exchange)]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(x => x.status === "rejected").length, 1);
  const result = outcomes.find(x => x.status === "fulfilled");
  assert.ok(result && result.status === "fulfilled");
  const grant = await f.service.authenticate(result.value.access_token);
  assert.equal(grant.adminId, "owner");
  assert.equal(JSON.stringify(f.repository.inspect()).includes(result.value.access_token), false);
});

test("refresh rotates and replay revokes the whole connection", async () => {
  const f = fixture(), a = await f.authorize(), tokens = await f.service.exchange(a.exchange);
  const input = { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: a.client.id, resource: f.resource };
  const rotated = await f.service.exchange(input);
  await f.service.authenticate(rotated.access_token);
  await assert.rejects(() => f.service.exchange(input), fails("invalid_grant"));
  await assert.rejects(() => f.service.authenticate(rotated.access_token), fails("invalid_token"));
});

test("wrong client/resource/redirect cannot exchange or revoke another grant", async () => {
  const f = fixture(), a = await f.authorize();
  for (const patch of [{ client_id: randomUUID() }, { resource: "https://wrong.example" }, { redirect_uri: "https://client.example/other" }]) {
    await assert.rejects(() => f.service.exchange({ ...a.exchange, ...patch }), fails("invalid_grant"));
  }
  const tokens = await f.service.exchange(a.exchange);
  await f.service.revokeToken(randomUUID(), tokens.access_token);
  await f.service.authenticate(tokens.access_token);
  await f.service.revokeToken(a.client.id, tokens.refresh_token);
  await assert.rejects(() => f.service.authenticate(tokens.access_token), fails("invalid_token"));
});

test("expiry and current account changes invalidate tokens before tools", async () => {
  for (const mutation of [(f: ReturnType<typeof fixture>) => f.advance(601_000), (f: ReturnType<typeof fixture>) => { f.account.isActive = false; }, (f: ReturnType<typeof fixture>) => { f.account.permissionVersion++; }, (f: ReturnType<typeof fixture>) => { f.account.mustChangePassword = true; }, (f: ReturnType<typeof fixture>) => { f.account.permissions.brands.read = false; }]) {
    const f = fixture(), a = await f.authorize(), tokens = await f.service.exchange(a.exchange);
    mutation(f); await assert.rejects(() => f.service.authenticate(tokens.access_token), fails("invalid_token"));
  }
  const f = fixture(), a = await f.authorize(); f.advance(121_000);
  await assert.rejects(() => f.service.exchange(a.exchange), fails("invalid_grant"));
});

test("consent cannot grant unsupported account permissions and replay cannot mint extra connections", async () => {
  const f = fixture(), a = await f.authorize(); f.account.permissions.events.update = false;
  await assert.rejects(() => f.service.authorize("owner", { ...a.request, scope: "showcase:moderate" }, randomUUID()), fails("access_denied"));
  const nonce = randomUUID(); await f.service.authorize("owner", a.request, nonce);
  await assert.rejects(() => f.service.authorize("owner", a.request, nonce));
  assert.equal((await f.repository.listGrants("different-admin")).length, 0);
  assert.notEqual(hashCredential(a.code), a.code);
});
