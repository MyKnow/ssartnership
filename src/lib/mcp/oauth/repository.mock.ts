import type { ProjectShowcaseRepository } from "../../project-showcase/repository.ts";
import type { McpOAuthRepository, McpClient, McpGrant, Credential, ExchangeInput, FeedbackReview } from "./contracts.ts";
import { hashCredential } from "./service.ts";

/** Local-fixture implementation only; production always uses the durable RPC adapter. */
export class MockMcpOAuthRepository implements McpOAuthRepository {
  private clients = new Map<string, McpClient>();
  private grants = new Map<string, McpGrant>();
  private credentials = new Map<string, Credential>();
  private reviews = new Map<string, FeedbackReview>();
  private queue = Promise.resolve();
  private feedback: Pick<ProjectShowcaseRepository, "listAdminFeedback" | "setFeedbackHidden"> | undefined;
  private now: () => number;
  constructor(feedback?: Pick<ProjectShowcaseRepository, "listAdminFeedback" | "setFeedbackHidden">, now = Date.now) { this.feedback = feedback; this.now = now; }
  private async locked<T>(operation: () => Promise<T> | T): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  inspect() { return structuredClone({ clients: [...this.clients.values()], grants: [...this.grants.values()], credentials: [...this.credentials.values()] }); }
  async registerClient(client: McpClient) { if (this.clients.has(client.id)) throw new Error("mcp_client_exists"); this.clients.set(client.id, structuredClone(client)); }
  async getClient(id: string) { return structuredClone(this.clients.get(id) ?? null); }
  async listClients(adminId: string) { return structuredClone([...this.clients.values()].filter(x => x.createdBy === adminId)); }
  async createGrant(grant: McpGrant, code: Credential) {
    return this.locked(() => {
      if (this.grants.has(grant.id)) throw new Error("mcp_consent_replayed");
      this.grants.set(grant.id, structuredClone(grant)); this.credentials.set(`${code.kind}:${code.hash}`, structuredClone(code));
    });
  }
  async readCredential(hash: string, kind: Credential["kind"]) {
    const credential = this.credentials.get(`${kind}:${hash}`);
    const grant = credential && this.grants.get(credential.grantId);
    return credential && grant ? structuredClone({ credential, grant }) : null;
  }
  async exchange(input: ExchangeInput) {
    return this.locked(() => {
      const record = this.credentials.get(`${input.kind}:${input.hash}`);
      const grant = record && this.grants.get(record.grantId);
      if (!record || !grant || grant.revoked || grant.expiresAt <= this.now() || record.expiresAt <= this.now() ||
        grant.clientId !== input.clientId || grant.resource !== input.resource ||
        (input.kind === "code" && (record.redirectUri !== input.redirectUri || record.challenge !== input.challenge))) return null;
      if (record.consumed) { if (input.kind === "refresh") grant.revoked = true; return null; }
      record.consumed = true;
      this.credentials.set(`access:${input.access.hash}`, structuredClone(input.access));
      this.credentials.set(`refresh:${input.refresh.hash}`, structuredClone(input.refresh));
      return structuredClone(grant);
    });
  }
  async listGrants(adminId: string) { return structuredClone([...this.grants.values()].filter(x => x.adminId === adminId && x.expiresAt > this.now()).sort((a,b) => b.createdAt-a.createdAt)); }
  async getGrant(id: string) { return structuredClone(this.grants.get(id) ?? null); }
  async revokeGrant(adminId: string, id: string) {
    await this.locked(() => { const grant = this.grants.get(id); if (grant?.adminId === adminId) grant.revoked = true; });
  }
  async createReview(review: FeedbackReview) { if (this.reviews.has(review.id)) throw new Error("mcp_review_exists"); this.reviews.set(review.id, structuredClone(review)); }
  async getReview(id: string) { return structuredClone(this.reviews.get(id) ?? null); }
  async approveReview(adminId: string, id: string) {
    return this.locked(() => { const review = this.reviews.get(id); if (!review || review.adminId !== adminId || review.expiresAt <= this.now()) return false; review.approved = true; return true; });
  }
  async commitReview(adminId: string, grantId: string, clientId: string, id: string) {
    return this.locked(async () => {
      const review = this.reviews.get(id), grant = this.grants.get(grantId);
      if (!review || !grant || grant.adminId !== adminId || grant.revoked || grant.clientId !== clientId || grant.expiresAt <= this.now() ||
        !grant.scopes.includes("showcase:moderate") || review.adminId !== adminId || review.grantId !== grantId || review.clientId !== clientId || !review.approved || review.expiresAt <= this.now()) return "forbidden" as const;
      if (review.executed) return "replayed" as const;
      const item = (await this.feedback?.listAdminFeedback())?.find(x => x.id === review.feedbackId);
      if (!item || item.hidden !== review.previousHidden || hashCredential(item.body)!==review.previousBodyHash) return "conflict" as const;
      await this.feedback!.setFeedbackHidden({ feedbackId: review.feedbackId, adminId, hidden: review.hidden });
      review.executed = true;
      return "executed" as const;
    });
  }
}
