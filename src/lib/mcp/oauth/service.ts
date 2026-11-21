import { createHash, randomBytes, randomUUID } from "node:crypto";
import { canAdmin } from "../../admin-permissions.ts";
import { isRegionalAdminAccount } from "../../admin-scope.ts";
import type { AdminAccount } from "../../admin-accounts.ts";
import { authorizationSchema, clientInputSchema, MCP_SCOPES, type McpOAuthRepository, type AuthorizationInput, type McpGrant } from "./contracts.ts";

export const ACCESS_TTL_MS = 10 * 60_000;
export const GRANT_TTL_MS = 30 * 24 * 60 * 60_000;
export const CODE_TTL_MS = 2 * 60_000;
export const hashCredential = (value: string) => createHash("sha256").update(value).digest("hex");
export const pkceChallenge = (value: string) => createHash("sha256").update(value).digest("base64url");
const newToken = () => randomBytes(32).toString("base64url");
export class McpOAuthError extends Error {
  readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "invalid_scope" | "invalid_token" | "access_denied";
  constructor(code: McpOAuthError["code"]) { super(code); this.code = code; }
}
export type McpOAuthDependencies = {
  repository: McpOAuthRepository; resource: string;
  getAdminAccount(id: string): Promise<AdminAccount | null>; now?: () => number;
};
export function isUsableAdmin(account: AdminAccount | null, version?: number): account is AdminAccount {
  return Boolean(account?.isActive && !account.mustChangePassword && (version === undefined || account.permissionVersion === version));
}
export function hasMcpScopePermission(account: AdminAccount, scope: string) {
  if (scope === "catalog:read") return canAdmin(account.permissions, "brands", "read");
  if (isRegionalAdminAccount(account)) return false;
  if (scope === "showcase:own-feedback:read") return canAdmin(account.permissions, "events", "read");
  return scope === "showcase:moderate" && canAdmin(account.permissions, "events", "update");
}
export function createMcpOAuthService(deps: McpOAuthDependencies) {
  const repo = deps.repository;
  const now = deps.now ?? Date.now;
  async function fresh(grant: McpGrant) {
    const account = await deps.getAdminAccount(grant.adminId);
    if (grant.revoked || grant.expiresAt <= now() || !isUsableAdmin(account, grant.permissionVersion) || account.id !== grant.adminId ||
      !grant.scopes.every((scope) => hasMcpScopePermission(account, scope))) throw new McpOAuthError("invalid_token");
    return account;
  }
  async function validateAuthorization(input: unknown) {
    let candidate=input;
    // RFC 8707 permits repeated resources. Some clients repeat the same audience;
    // collapse only that exact pinned value, never another field or audience.
    if(input && typeof input === "object" && "resource" in input && Array.isArray(input.resource)) {
      if(!input.resource.length || input.resource.length>8 || !input.resource.every(value=>value===deps.resource)) throw new McpOAuthError("invalid_request");
      candidate={...input,resource:deps.resource};
    }
    const parsed = authorizationSchema.safeParse(candidate);
    if (!parsed.success) throw new McpOAuthError("invalid_request");
    const value = parsed.data;
    const client = await repo.getClient(value.client_id);
    if (!client || client.redirectUri !== value.redirect_uri) throw new McpOAuthError("invalid_client");
    if (value.resource !== deps.resource) throw new McpOAuthError("invalid_request");
    const scopes = [...new Set(value.scope.split(" ").filter(Boolean))];
    if (!scopes.length || scopes.some((scope) => !MCP_SCOPES.includes(scope as typeof MCP_SCOPES[number]))) throw new McpOAuthError("invalid_scope");
    return { value, client, scopes };
  }
  return {
    validateAuthorization,
    fresh,
    async registerClient(adminId: string, input: unknown, registrationId: string = randomUUID()) {
      const account = await deps.getAdminAccount(adminId);
      if (!isUsableAdmin(account) || account.permissionId !== "super_admin" || !canAdmin(account.permissions, "admin_management", "create")) throw new McpOAuthError("access_denied");
      const parsed = clientInputSchema.safeParse(input);
      if (!parsed.success) throw new McpOAuthError("invalid_request");
      const client = { id: registrationId, ...parsed.data, createdBy: adminId };
      await repo.registerClient(client);
      return client;
    },
    async authorize(adminId: string, input: AuthorizationInput, consentId: string) {
      const { value, scopes } = await validateAuthorization(input);
      const account = await deps.getAdminAccount(adminId);
      if (!isUsableAdmin(account) || scopes.some((scope) => !hasMcpScopePermission(account, scope))) throw new McpOAuthError("access_denied");
      const issuedAt = now();
      const grant: McpGrant = { id: consentId, adminId, permissionVersion: account.permissionVersion, clientId: value.client_id,
        resource: deps.resource, scopes, createdAt: issuedAt, expiresAt: issuedAt + GRANT_TTL_MS };
      const code = newToken();
      await repo.createGrant(grant, { kind: "code", hash: hashCredential(code), grantId: grant.id, expiresAt: issuedAt + CODE_TTL_MS,
        challenge: value.code_challenge, redirectUri: value.redirect_uri });
      return code;
    },
    async exchange(input: Record<string, string>) {
      const kind = input.grant_type === "authorization_code" ? "code" : input.grant_type === "refresh_token" ? "refresh" : null;
      const token = kind === "code" ? input.code : input.refresh_token;
      if (!kind || !token || !/^[A-Za-z0-9_-]{43}$/.test(token) || input.resource !== deps.resource) throw new McpOAuthError("invalid_grant");
      if (kind === "code" && (!input.code_verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier))) throw new McpOAuthError("invalid_grant");
      const record = await repo.readCredential(hashCredential(token), kind);
      if (!record || record.grant.clientId !== input.client_id || record.grant.resource !== deps.resource || record.credential.expiresAt <= now()) throw new McpOAuthError("invalid_grant");
      try { await fresh(record.grant); } catch { throw new McpOAuthError("invalid_grant"); }
      // Optional scope narrowing is deliberately unsupported; never silently widen or ignore it.
      if (input.scope && input.scope !== record.grant.scopes.join(" ")) throw new McpOAuthError("invalid_scope");
      const access = newToken(), refresh = newToken();
      const base = { grantId: record.grant.id, expiresAt: Math.min(now() + ACCESS_TTL_MS,record.grant.expiresAt) };
      const grant = await repo.exchange({ kind, hash: hashCredential(token), clientId: input.client_id, resource: deps.resource,
        challenge: kind === "code" ? pkceChallenge(input.code_verifier) : undefined, redirectUri: input.redirect_uri,
        access: { ...base, kind: "access", hash: hashCredential(access) },
        refresh: { ...base, kind: "refresh", hash: hashCredential(refresh), expiresAt: record.grant.expiresAt } });
      if (!grant) throw new McpOAuthError("invalid_grant");
      return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: Math.max(1,Math.floor((base.expiresAt-now())/1000)), scope: grant.scopes.join(" "), resource:grant.resource };
    },
    async authenticate(token: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new McpOAuthError("invalid_token");
      const record = await repo.readCredential(hashCredential(token), "access");
      if (!record || record.credential.expiresAt <= now() || record.grant.resource !== deps.resource) throw new McpOAuthError("invalid_token");
      await fresh(record.grant);
      return record.grant;
    },
    async revokeToken(clientId: string, token: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
      for (const kind of ["access", "refresh"] as const) {
        const record = await repo.readCredential(hashCredential(token), kind);
        if (record && record.grant.clientId === clientId) await repo.revokeGrant(record.grant.adminId, record.grant.id);
      }
    },
  };
}
