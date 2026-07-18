import type { PolicyDocument } from "@/lib/policy-documents";
import {
  toSafeMattermostSignupApprovalRequest,
  type MattermostSignupApprovalRequestSummary,
  type MattermostSignupParseReason,
} from "@/lib/mm-signup-approval";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const SAFE_REQUEST_SELECT = [
  "id",
  "mm_user_id",
  "mm_username",
  "mattermost_display_name",
  "sender_generation",
  "requested_generation",
  "parse_exclusion_reason",
  "status",
  "marketing_policy_checked",
  "consent_agreed_at",
  "created_at",
  "updated_at",
].join(",");

export class MattermostSignupApprovalRepositoryError extends Error {
  readonly code: "db_error" | "already_pending" | "decision_failed";

  constructor(
    code: "db_error" | "already_pending" | "decision_failed",
    message = "Mattermost 가입 승인 요청을 처리하지 못했습니다.",
  ) {
    super(message);
    this.name = "MattermostSignupApprovalRepositoryError";
    this.code = code;
  }
}

export type CreateMattermostSignupApprovalRequestInput = {
  mmUserId: string;
  mattermostAccountId: string;
  mmUsername: string;
  mattermostDisplayName: string;
  senderGeneration: number;
  requestedGeneration: number;
  parseExclusionReason: MattermostSignupParseReason | null;
  passwordHash: string;
  passwordSalt: string;
  servicePolicy: PolicyDocument;
  privacyPolicy: PolicyDocument;
  marketingPolicy: PolicyDocument | null;
  marketingPolicyChecked: boolean;
  ipAddress: string | null;
  userAgent: string | null;
};

function mapSafeRow(row: unknown): MattermostSignupApprovalRequestSummary {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new MattermostSignupApprovalRepositoryError("db_error");
  }
  return toSafeMattermostSignupApprovalRequest(row as Record<string, unknown>);
}

export async function findPendingMattermostSignupApprovalRequest(
  mmUserId: string,
) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_signup_approval_requests")
    .select(SAFE_REQUEST_SELECT)
    .eq("mm_user_id", mmUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) {
    throw new MattermostSignupApprovalRepositoryError("db_error");
  }
  return data ? mapSafeRow(data) : null;
}

export async function createMattermostSignupApprovalRequest(
  input: CreateMattermostSignupApprovalRequestInput,
) {
  const existing = await findPendingMattermostSignupApprovalRequest(input.mmUserId);
  if (existing) {
    return { status: "pending" as const, request: existing };
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("member_signup_approval_requests")
    .insert({
      mm_user_id: input.mmUserId,
      mattermost_account_id: input.mattermostAccountId,
      mm_username: input.mmUsername,
      mattermost_display_name: input.mattermostDisplayName,
      sender_generation: input.senderGeneration,
      requested_generation: input.requestedGeneration,
      parse_exclusion_reason: input.parseExclusionReason,
      password_hash: input.passwordHash,
      password_salt: input.passwordSalt,
      service_policy_document_id: input.servicePolicy.id,
      service_policy_version: input.servicePolicy.version,
      privacy_policy_document_id: input.privacyPolicy.id,
      privacy_policy_version: input.privacyPolicy.version,
      marketing_policy_document_id: input.marketingPolicyChecked
        ? input.marketingPolicy?.id ?? null
        : null,
      marketing_policy_version: input.marketingPolicyChecked
        ? input.marketingPolicy?.version ?? null
        : null,
      marketing_policy_checked: input.marketingPolicyChecked,
      consent_ip_address: input.ipAddress,
      consent_user_agent: input.userAgent,
    })
    .select(SAFE_REQUEST_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      const pending = await findPendingMattermostSignupApprovalRequest(input.mmUserId);
      if (pending) {
        return { status: "pending" as const, request: pending };
      }
      throw new MattermostSignupApprovalRepositoryError("already_pending");
    }
    throw new MattermostSignupApprovalRepositoryError("db_error");
  }

  return {
    status: "created" as const,
    request: mapSafeRow(data),
  };
}

export async function listMattermostSignupApprovalRequests(
  status: "pending" | "approved" | "rejected" = "pending",
) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_signup_approval_requests")
    .select(SAFE_REQUEST_SELECT)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) {
    throw new MattermostSignupApprovalRepositoryError("db_error");
  }
  return (data ?? []).map(mapSafeRow);
}

export async function getMattermostSignupApprovalRequest(id: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_signup_approval_requests")
    .select(SAFE_REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new MattermostSignupApprovalRepositoryError("db_error");
  }
  return data ? mapSafeRow(data) : null;
}

export async function approveMattermostSignupApprovalRequest(input: {
  requestId: string;
  adminId: string;
  displayName: string;
  generation: number;
  campus: string | null;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "approve_member_signup_approval_request",
    {
      p_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_display_name: input.displayName,
      p_generation: input.generation,
      p_campus: input.campus,
    },
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new MattermostSignupApprovalRepositoryError("decision_failed");
  }
  const memberId = (data as Record<string, unknown>).member_id;
  if (typeof memberId !== "string" || !memberId) {
    throw new MattermostSignupApprovalRepositoryError("decision_failed");
  }
  return { memberId };
}

export async function rejectMattermostSignupApprovalRequest(input: {
  requestId: string;
  adminId: string;
  reason: string;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reject_member_signup_approval_request",
    {
      p_request_id: input.requestId,
      p_admin_id: input.adminId,
      p_reason: input.reason,
    },
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new MattermostSignupApprovalRepositoryError("decision_failed");
  }
  return { status: "rejected" as const };
}
