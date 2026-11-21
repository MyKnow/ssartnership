import { getSupabaseAdminClient } from "../../supabase/server";
import type { McpOAuthRepository, McpClient, McpGrant, Credential, ExchangeInput, FeedbackReview } from "./contracts";

export class SupabaseMcpOAuthRepository implements McpOAuthRepository {
  private async read<T>(key: string): Promise<T | null> {
    const { data, error } = await getSupabaseAdminClient().from("mcp_oauth_records").select("value").eq("key",key).maybeSingle();
    if (error) throw new Error("mcp_storage_unavailable");
    return (data?.value as T | undefined) ?? null;
  }
  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await getSupabaseAdminClient().rpc(name,args);
    if (error) throw new Error("mcp_storage_unavailable");
    return data as T;
  }
  async registerClient(client: McpClient) {
    const { error } = await getSupabaseAdminClient().from("mcp_oauth_clients").insert({ id:client.id,value:client });
    if (error) throw new Error("mcp_storage_unavailable");
  }
  async getClient(id: string): Promise<McpClient | null> {
    const { data,error } = await getSupabaseAdminClient().from("mcp_oauth_clients").select("value").eq("id",id).maybeSingle();
    if (error) throw new Error("mcp_storage_unavailable");
    return data?.value ?? null;
  }
  async listClients(adminId: string): Promise<McpClient[]> {
    const { data,error } = await getSupabaseAdminClient().from("mcp_oauth_clients").select("value").eq("value->>createdBy",adminId).order("created_at",{ascending:false}).limit(100);
    if (error) throw new Error("mcp_storage_unavailable");
    return (data ?? []).map(x=>x.value as McpClient);
  }
  async createGrant(grant: McpGrant, code: Credential) { await this.rpc("mcp_create_grant",{p_grant:grant,p_code:code}); }
  async readCredential(hash: string, kind: Credential["kind"]) {
    const credential = await this.read<Credential>(`${kind}:${hash}`);
    const grant = credential && await this.read<McpGrant>(`grant:${credential.grantId}`);
    return credential && grant ? { credential,grant } : null;
  }
  exchange(input: ExchangeInput) { return this.rpc<McpGrant | null>("mcp_exchange_credential",{p_input:input}); }
  async listGrants(adminId: string): Promise<McpGrant[]> {
    const { data,error } = await getSupabaseAdminClient().from("mcp_oauth_records").select("value").like("key","grant:%").eq("value->>adminId",adminId).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100);
    if (error) throw new Error("mcp_storage_unavailable");
    return (data ?? []).map(x=>x.value as McpGrant);
  }
  getGrant(id: string) { return this.read<McpGrant>(`grant:${id}`); }
  async revokeGrant(adminId: string,id: string) { await this.rpc("mcp_revoke_grant",{p_admin_id:adminId,p_id:id}); }
  async createReview(review: FeedbackReview) {
    const { error } = await getSupabaseAdminClient().from("mcp_oauth_records").insert({ key:`review:${review.id}`,value:review,expires_at:new Date(review.expiresAt).toISOString() });
    if (error) throw new Error("mcp_storage_unavailable");
  }
  getReview(id: string) { return this.read<FeedbackReview>(`review:${id}`); }
  approveReview(adminId: string,id: string) { return this.rpc<boolean>("mcp_approve_review",{p_admin_id:adminId,p_id:id}); }
  commitReview(adminId: string,grantId: string,clientId: string,id: string) {
    return this.rpc<"executed"|"replayed"|"conflict"|"forbidden">("mcp_commit_review",{p_admin_id:adminId,p_grant_id:grantId,p_client_id:clientId,p_id:id});
  }
}
