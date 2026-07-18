import { buildAtomicAuditRpcContext, type AtomicAuditContext } from "@/lib/audit-rpc-context";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  decryptMattermostSenderCredentials,
  type EncryptedMattermostSenderCredentials,
  type MattermostSenderKeyring,
} from "./crypto";
import {
  MATTERMOST_SENDER_STATUSES,
  type ActiveMattermostSenderHealthRecord,
  type ActiveMattermostSender,
  type MattermostSenderMetadata,
  type MattermostSenderSafeErrorCode,
  type MattermostSenderTestContext,
  type MattermostSenderStatus,
} from "./types";
import {
  MATTERMOST_SENDER_HEALTH_STATUSES,
  getMattermostSenderHealthFailurePolicy,
  type MattermostSenderHealthStatus,
} from "./health";

type SenderAuditInput = {
  context: AtomicAuditContext;
  properties: Record<string, unknown>;
};

export type PendingMattermostSenderCandidate = {
  id: string;
  generation: number;
  loginIdHint: string;
  credentials: {
    loginId: string;
    password: string;
  };
};

function isMattermostSenderStatus(value: unknown): value is MattermostSenderStatus {
  return typeof value === "string"
    && (MATTERMOST_SENDER_STATUSES as readonly string[]).includes(value);
}

function isSafeErrorCode(value: unknown): value is MattermostSenderSafeErrorCode {
  return typeof value === "string" && [
    "test_target_unavailable",
    "unauthorized",
    "forbidden",
    "rate_limited",
    "not_found",
    "unavailable",
    "timeout",
    "invalid_response",
    "request_rejected",
    "configuration_invalid",
  ].includes(value);
}

function isHealthStatus(value: unknown): value is MattermostSenderHealthStatus {
  return typeof value === "string"
    && (MATTERMOST_SENDER_HEALTH_STATUSES as readonly string[]).includes(value);
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asIsoString(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    return null;
  }
  return value;
}

function mapMetadata(row: unknown): MattermostSenderMetadata | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const value = row as Record<string, unknown>;
  const id = value.id;
  const generation = value.generation;
  const status = value.status;
  const loginIdHint = value.login_id_hint;
  if (
    typeof id !== "string"
    || !id
    || typeof generation !== "number"
    || !Number.isSafeInteger(generation)
    || !isMattermostSenderStatus(status)
    || typeof loginIdHint !== "string"
    || !loginIdHint
  ) {
    return null;
  }

  const targetKind = value.last_test_target_kind;
  if (
    targetKind !== null
    && targetKind !== undefined
    && targetKind !== "previous_generation_sender"
    && targetKind !== "super_admin_bootstrap"
  ) {
    return null;
  }

  const createdAt = asIsoString(value.created_at);
  const updatedAt = asIsoString(value.updated_at);
  if (!createdAt || !updatedAt) {
    return null;
  }

  const healthFailureCount = value.health_failure_count;
  if (
    healthFailureCount !== undefined
    && (typeof healthFailureCount !== "number"
      || !Number.isSafeInteger(healthFailureCount)
      || healthFailureCount < 0)
  ) {
    return null;
  }

  return {
    id,
    generation,
    status,
    loginIdHint,
    senderUsernameHint: asNullableString(value.sender_username_hint),
    verifiedAt: asIsoString(value.verified_at),
    lastTestedAt: asIsoString(value.last_tested_at),
    lastTestTargetKind: targetKind === "previous_generation_sender"
      || targetKind === "super_admin_bootstrap"
      ? targetKind
      : null,
    lastErrorCode: isSafeErrorCode(value.last_error_code)
      ? value.last_error_code
      : null,
    healthStatus: isHealthStatus(value.health_status) ? value.health_status : "unknown",
    healthCheckedAt: asIsoString(value.health_checked_at),
    healthFailureCount: healthFailureCount ?? 0,
    healthBlockedUntil: asIsoString(value.health_blocked_until),
    healthLastErrorCode: isSafeErrorCode(value.health_last_error_code)
      ? value.health_last_error_code
      : null,
    expiresAt: asIsoString(value.expires_at),
    createdAt,
    updatedAt,
  };
}

function getEncryptedCredentials(row: Record<string, unknown>) {
  const ciphertext = row.encrypted_ciphertext;
  const nonce = row.encrypted_nonce;
  const authTag = row.encrypted_auth_tag;
  const keyVersion = row.key_version;
  if (
    typeof ciphertext !== "string"
    || typeof nonce !== "string"
    || typeof authTag !== "string"
    || typeof keyVersion !== "number"
    || !Number.isSafeInteger(keyVersion)
  ) {
    return null;
  }
  return {
    ciphertext,
    nonce,
    authTag,
    keyVersion,
  } satisfies EncryptedMattermostSenderCredentials;
}

function toAuditRpcParams(input: SenderAuditInput) {
  const audit = buildAtomicAuditRpcContext(input.context, input.properties);
  if (audit.p_actor_type !== "admin" || !audit.p_actor_id) {
    throw new Error("Mattermost Sender 작업에는 관리자 감사 주체가 필요합니다.");
  }
  return {
    p_actor_id: audit.p_actor_id,
    p_request_id: audit.p_request_id,
    p_path: audit.p_path,
    p_user_agent: audit.p_user_agent,
    p_ip_address: audit.p_ip_address,
    p_properties: audit.p_properties,
  };
}

function throwRepositoryError(): never {
  throw new Error("Mattermost Sender 정보를 처리하지 못했습니다.");
}

export class MattermostSenderRepository {
  async expirePendingCandidates() {
    const { error } = await getSupabaseAdminClient().rpc(
      "expire_pending_mattermost_sender_candidates",
    );
    if (error) {
      throwRepositoryError();
    }
  }

  async listMetadata(): Promise<MattermostSenderMetadata[]> {
    await this.expirePendingCandidates();
    const { data, error } = await getSupabaseAdminClient().rpc(
      "list_mattermost_sender_metadata",
    );
    if (error) {
      throwRepositoryError();
    }
    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows
      .map(mapMetadata)
      .filter((row): row is MattermostSenderMetadata => row !== null);
  }

  async getMetadataById(id: string) {
    const metadata = await this.listMetadata();
    return metadata.find((sender) => sender.id === id) ?? null;
  }

  async saveCandidate(input: {
    generation: number;
    loginIdHint: string;
    encryptedCredentials: EncryptedMattermostSenderCredentials;
    audit: SenderAuditInput;
  }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "save_mattermost_sender_candidate_with_audit",
      {
        p_generation: input.generation,
        p_login_id_hint: input.loginIdHint,
        p_ciphertext: input.encryptedCredentials.ciphertext,
        p_nonce: input.encryptedCredentials.nonce,
        p_auth_tag: input.encryptedCredentials.authTag,
        p_key_version: input.encryptedCredentials.keyVersion,
        ...toAuditRpcParams(input.audit),
      },
    );
    if (error || typeof data !== "string") {
      throwRepositoryError();
    }
    return data;
  }

  async getPendingCandidateForTest(
    candidateId: string,
    keyring: MattermostSenderKeyring,
  ): Promise<PendingMattermostSenderCandidate | null> {
    await this.expirePendingCandidates();
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_mattermost_sender_candidate_for_test",
      { p_candidate_id: candidateId },
    );
    if (error) {
      throwRepositoryError();
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return null;
    }
    const value = row as Record<string, unknown>;
    const encryptedCredentials = getEncryptedCredentials(value);
    const id = value.id;
    const candidateGeneration = value.generation;
    const loginIdHint = value.login_id_hint;
    if (
      typeof id !== "string"
      || typeof candidateGeneration !== "number"
      || !Number.isSafeInteger(candidateGeneration)
      || typeof loginIdHint !== "string"
      || !encryptedCredentials
    ) {
      throwRepositoryError();
    }
    return {
      id,
      generation: candidateGeneration,
      loginIdHint,
      credentials: decryptMattermostSenderCredentials(encryptedCredentials, keyring),
    };
  }

  async getActiveSenderForGeneration(
    generation: number,
    keyring: MattermostSenderKeyring,
  ): Promise<ActiveMattermostSender | null> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_active_mattermost_sender_credentials",
      { p_generation: generation },
    );
    if (error) {
      throwRepositoryError();
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return null;
    }
    const value = row as Record<string, unknown>;
    const encryptedCredentials = getEncryptedCredentials(value);
    const id = value.id;
    const senderGeneration = value.generation;
    const senderMattermostUserId = value.sender_mm_user_id;
    if (
      typeof id !== "string"
      || typeof senderGeneration !== "number"
      || !Number.isSafeInteger(senderGeneration)
      || typeof senderMattermostUserId !== "string"
      || !senderMattermostUserId
      || !encryptedCredentials
    ) {
      throwRepositoryError();
    }
    return {
      id,
      generation: senderGeneration,
      credentials: decryptMattermostSenderCredentials(encryptedCredentials, keyring),
      senderMattermostUserId,
      senderMattermostUsername: asNullableString(value.sender_username_hint),
    };
  }

  async listActiveSendersForHealthCheck(
    keyring: MattermostSenderKeyring,
  ): Promise<ActiveMattermostSenderHealthRecord[]> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "list_active_mattermost_sender_credentials_for_health_check",
    );
    if (error) {
      throwRepositoryError();
    }
    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return [];
      const value = row as Record<string, unknown>;
      const encryptedCredentials = getEncryptedCredentials(value);
      const id = value.id;
      const generation = value.generation;
      const senderMattermostUserId = value.sender_mm_user_id;
      if (
        typeof id !== "string"
        || typeof generation !== "number"
        || !Number.isSafeInteger(generation)
        || typeof senderMattermostUserId !== "string"
        || !senderMattermostUserId
        || !encryptedCredentials
      ) {
        return [];
      }
      return [{
        id,
        generation,
        credentials: decryptMattermostSenderCredentials(encryptedCredentials, keyring),
        senderMattermostUserId,
        senderMattermostUsername: asNullableString(value.sender_username_hint),
      }];
    });
  }

  async recordHealthSuccess(senderId: string) {
    const { error } = await getSupabaseAdminClient().rpc(
      "record_mattermost_sender_health_success",
      { p_sender_id: senderId },
    );
    if (error) {
      throwRepositoryError();
    }
  }

  async recordHealthFailure(input: {
    senderId: string;
    errorCode: MattermostSenderSafeErrorCode;
  }) {
    const policy = getMattermostSenderHealthFailurePolicy(input.errorCode);
    if (!policy) return;
    const { error } = await getSupabaseAdminClient().rpc(
      "record_mattermost_sender_health_failure",
      {
        p_sender_id: input.senderId,
        p_error_code: input.errorCode,
      },
    );
    if (error) {
      throwRepositoryError();
    }
  }

  async getTestContext(
    generation: number,
    adminMemberId: string,
  ): Promise<MattermostSenderTestContext> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_mattermost_sender_test_context",
      {
        p_generation: generation,
        p_admin_member_id: adminMemberId,
      },
    );
    if (error) {
      throwRepositoryError();
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return {
        previousGenerationSenderUserId: null,
        superAdminMattermostUserId: null,
      };
    }
    const value = row as Record<string, unknown>;
    return {
      previousGenerationSenderUserId: asNullableString(
        value.previous_generation_sender_user_id,
      ),
      superAdminMattermostUserId: asNullableString(
        value.super_admin_mattermost_user_id,
      ),
    };
  }

  async recordTestFailure(input: {
    candidateId: string;
    errorCode: MattermostSenderSafeErrorCode;
    audit: SenderAuditInput;
  }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "record_mattermost_sender_test_failure_with_audit",
      {
        p_candidate_id: input.candidateId,
        p_error_code: input.errorCode,
        ...toAuditRpcParams(input.audit),
      },
    );
    if (error) {
      throwRepositoryError();
    }
  }

  async activateCandidate(input: {
    candidateId: string;
    senderMattermostUserId: string;
    senderUsernameHint: string;
    testTargetKind: "previous_generation_sender" | "super_admin_bootstrap";
    audit: SenderAuditInput;
  }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "activate_mattermost_sender_candidate_with_audit",
      {
        p_candidate_id: input.candidateId,
        p_sender_mm_user_id: input.senderMattermostUserId,
        p_sender_username_hint: input.senderUsernameHint,
        p_test_target_kind: input.testTargetKind,
        ...toAuditRpcParams(input.audit),
      },
    );
    if (error || typeof data !== "string") {
      throwRepositoryError();
    }
    return data;
  }

  async disableSender(input: {
    candidateId: string;
    generationConfirmation: number;
    audit: SenderAuditInput;
  }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "disable_mattermost_sender_with_audit",
      {
        p_candidate_id: input.candidateId,
        p_generation_confirmation: input.generationConfirmation,
        ...toAuditRpcParams(input.audit),
      },
    );
    if (error || typeof data !== "string") {
      throwRepositoryError();
    }
    return data;
  }
}

export const mattermostSenderRepository = new MattermostSenderRepository();
