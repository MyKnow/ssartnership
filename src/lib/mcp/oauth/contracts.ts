import { z } from "zod";
export const MCP_CLIENT_NAME_LIMIT = 80;
export const MCP_CALLBACK_URL_LIMIT = 2048;

export const MCP_SCOPES = ["catalog:read", "showcase:own-feedback:read", "showcase:moderate"] as const;
export const MCP_SCOPE_LABELS: Record<string, string> = {
  "catalog:read": "공개 제휴처 조회",
  "showcase:own-feedback:read": "내 출품 리뷰 조회",
  "showcase:moderate": "리뷰 숨김·복원 검토 및 실행",
};
export const callbackSchema = z.string().url().max(MCP_CALLBACK_URL_LIMIT).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password && !url.hash &&
    (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
});
export const clientInputSchema = z.strictObject({ name: z.string().trim().min(2).max(MCP_CLIENT_NAME_LIMIT), redirectUri: callbackSchema });
export const authorizationSchema = z.strictObject({
  client_id: z.string().uuid(), redirect_uri: callbackSchema, response_type: z.literal("code"),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal("S256"),
  resource: z.string().url().max(2048), scope: z.string().max(200).default("catalog:read"),
  state: z.string().max(512).optional(),
});
export type AuthorizationInput = z.infer<typeof authorizationSchema>;
export type McpClient = { id: string; name: string; redirectUri: string; createdBy: string };
export type McpGrant = {
  id: string; adminId: string; permissionVersion: number; clientId: string; scopes: string[];
  resource: string; createdAt: number; expiresAt: number; revoked?: boolean;
};
export type Credential = {
  kind: "code" | "access" | "refresh"; hash: string; grantId: string; expiresAt: number;
  redirectUri?: string; challenge?: string; consumed?: boolean;
};
export type ExchangeInput = {
  kind: "code" | "refresh"; hash: string; clientId: string; resource: string;
  redirectUri?: string; challenge?: string; access: Credential; refresh: Credential;
};
export type FeedbackReview = {
  id: string; grantId: string; adminId: string; clientId: string; feedbackId: string;
  previousHidden: boolean; previousBodyHash: string; hidden: boolean; expiresAt: number; approved?: boolean; executed?: boolean;
};
export interface McpOAuthRepository {
  registerClient(client: McpClient): Promise<void>;
  getClient(id: string): Promise<McpClient | null>;
  listClients(adminId: string): Promise<McpClient[]>;
  createGrant(grant: McpGrant, code: Credential): Promise<void>;
  readCredential(hash: string, kind: Credential["kind"]): Promise<{ credential: Credential; grant: McpGrant } | null>;
  exchange(input: ExchangeInput): Promise<McpGrant | null>;
  listGrants(adminId: string): Promise<McpGrant[]>;
  getGrant(id: string): Promise<McpGrant | null>;
  revokeGrant(adminId: string, id: string): Promise<void>;
  createReview(review: FeedbackReview): Promise<void>;
  getReview(id: string): Promise<FeedbackReview | null>;
  approveReview(adminId: string, id: string): Promise<boolean>;
  commitReview(adminId: string, grantId: string, clientId: string, id: string): Promise<"executed" | "replayed" | "conflict" | "forbidden">;
}
