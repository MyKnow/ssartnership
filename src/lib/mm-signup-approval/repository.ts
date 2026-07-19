import type { PolicyDocument } from "@/lib/policy-documents";
import {
  toSafeMattermostSignupApprovalRequest,
  type MattermostSignupApprovalRequestSummary,
  type MattermostSignupParseReason,
} from "@/lib/mm-signup-approval";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import { getSignupApprovalExpiresAt } from "@/lib/image-upload/signup";
import { attachMattermostSignupApprovalProfileImage } from "@/lib/member-signup-profile";

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
  "expires_at",
].join(",");

const DETAIL_REQUEST_SELECT = `${SAFE_REQUEST_SELECT},profile_image_upload_id`;

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
  profileImageUploadId?: string | null;
  signupUploadOwnerId?: string | null;
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
    const existingContext = await getMattermostSignupApprovalProfileImageContext(existing.id);
    if (
      input.profileImageUploadId
      && input.profileImageUploadId !== existingContext?.uploadId
      && input.signupUploadOwnerId
    ) {
      await getImageUploadRepository().discard({
        actor: { kind: "signup", id: input.signupUploadOwnerId },
        purpose: "member-signup-profile",
        uploadId: input.profileImageUploadId,
      }).catch(() => undefined);
    }
    return { status: "pending" as const, request: existing };
  }

  const expiresAt = getSignupApprovalExpiresAt();
  if (input.profileImageUploadId) {
    if (!input.signupUploadOwnerId) {
      throw new MattermostSignupApprovalRepositoryError("db_error");
    }
    await getImageUploadRepository().retainForApproval({
      actor: { kind: "signup", id: input.signupUploadOwnerId },
      purpose: "member-signup-profile",
      uploadId: input.profileImageUploadId,
      role: "profile",
      expiresAt,
    });
  }

  try {
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
        profile_image_upload_id: input.profileImageUploadId ?? null,
        expires_at: expiresAt.toISOString(),
      })
      .select(SAFE_REQUEST_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        const pending = await findPendingMattermostSignupApprovalRequest(input.mmUserId);
        if (pending) {
          if (input.profileImageUploadId && input.signupUploadOwnerId) {
            await getImageUploadRepository().discard({
              actor: { kind: "signup", id: input.signupUploadOwnerId },
              purpose: "member-signup-profile",
              uploadId: input.profileImageUploadId,
            }).catch(() => undefined);
          }
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
  } catch (error) {
    if (input.profileImageUploadId && input.signupUploadOwnerId) {
      await getImageUploadRepository().discard({
        actor: { kind: "signup", id: input.signupUploadOwnerId },
        purpose: "member-signup-profile",
        uploadId: input.profileImageUploadId,
      }).catch(() => undefined);
    }
    throw error;
  }
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
    .select(DETAIL_REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new MattermostSignupApprovalRepositoryError("db_error");
  }
  return data ? mapSafeRow(data) : null;
}

type ApprovalProfileImageContext = {
  requestId: string;
  status: "pending" | "approved" | "rejected";
  uploadId: string | null;
  ownerId: string;
  expiresAt: Date;
  memberId: string | null;
};

/** Server-only lookup. The upload owner and ID never enter admin DTOs. */
export async function getMattermostSignupApprovalProfileImageContext(
  requestId: string,
): Promise<ApprovalProfileImageContext | null> {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("member_signup_approval_requests")
    .select("id,status,profile_image_upload_id,expires_at,mattermost_account_id")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError || !request) return null;

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("mattermost_account_id", request.mattermost_account_id)
    .is("deleted_at", null)
    .maybeSingle();
  const status = request.status === "approved" || request.status === "rejected"
    ? request.status
    : "pending";
  const base = {
    requestId,
    status,
    expiresAt: new Date(String(request.expires_at)),
    memberId: typeof member?.id === "string" ? member.id : null,
  } as const;
  if (!request.profile_image_upload_id) {
    return { ...base, uploadId: null, ownerId: "" };
  }

  const { data: upload, error: uploadError } = await supabase
    .from("image_upload_sessions")
    .select("id,owner_kind,owner_id,purpose,role")
    .eq("id", request.profile_image_upload_id)
    .maybeSingle();
  if (
    uploadError
    || !upload
    || upload.owner_kind !== "signup"
    || upload.purpose !== "member-signup-profile"
    || upload.role !== "profile"
  ) {
    return null;
  }
  return {
    ...base,
    uploadId: upload.id,
    ownerId: upload.owner_id,
  };
}

export async function approveMattermostSignupApprovalRequest(input: {
  requestId: string;
  adminId: string;
  displayName: string;
  generation: number;
  campus: string | null;
}) {
  const context = await getMattermostSignupApprovalProfileImageContext(input.requestId);
  if (!context) {
    throw new MattermostSignupApprovalRepositoryError("decision_failed");
  }
  if (context.status === "approved" && context.memberId) {
    return { memberId: context.memberId };
  }
  if (context.status !== "pending" || context.expiresAt.getTime() <= Date.now()) {
    throw new MattermostSignupApprovalRepositoryError("decision_failed");
  }
  if (context.uploadId) {
    await attachMattermostSignupApprovalProfileImage({
      requestId: input.requestId,
      uploadId: context.uploadId,
      signupUploadOwnerId: context.ownerId,
    });
  }
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
  const context = await getMattermostSignupApprovalProfileImageContext(input.requestId);
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
  if (context?.uploadId) {
    await getImageUploadRepository().discard({
      actor: { kind: "signup", id: context.ownerId },
      purpose: "member-signup-profile",
      uploadId: context.uploadId,
    }).catch(() => undefined);
  }
  return { status: "rejected" as const };
}

export async function expireMattermostSignupApprovalRequests(now = new Date()) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "expire_pending_member_signup_approval_requests",
    { p_now: now.toISOString() },
  );
  if (error) {
    throw new MattermostSignupApprovalRepositoryError("decision_failed");
  }
  const rows = Array.isArray(data) ? data : [];
  let cleanupPending = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.request_id !== "string" || typeof record.profile_image_upload_id !== "string") {
      continue;
    }
    const context = await getMattermostSignupApprovalProfileImageContext(record.request_id);
    if (!context?.ownerId) continue;
    try {
      await getImageUploadRepository().discard({
        actor: { kind: "signup", id: context.ownerId },
        purpose: "member-signup-profile",
        uploadId: record.profile_image_upload_id,
        now,
      });
    } catch {
      cleanupPending += 1;
    }
  }
  return { expiredRequests: rows.length, cleanupPending };
}
