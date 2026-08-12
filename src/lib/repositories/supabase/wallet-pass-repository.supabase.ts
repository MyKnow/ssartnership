import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  AppleWalletDeviceRegistration,
  IssueMemberWalletPassInput,
  IssueMemberWalletPassResult,
  MemberWalletPass,
  MemberWalletPassRevision,
  ReconcileWalletPassContentInput,
  RegisterAppleWalletDeviceInput,
  RegisterAppleWalletDeviceResult,
  RevokeMemberWalletPassInput,
  RevokeMemberWalletPassResult,
  UnregisterAppleWalletDeviceInput,
  UnregisterAppleWalletDeviceResult,
  UpdatedAppleWalletPass,
  WalletPassPlatform,
  WalletPassRepository,
} from "@/lib/repositories/wallet-pass-repository";

type WalletPassRow = {
  id: string;
  member_id: string;
  platform: WalletPassPlatform;
  public_id: string;
  serial_number: string;
  credential_status: MemberWalletPass["credentialStatus"];
  installation_status: MemberWalletPass["installationStatus"];
  sync_status: MemberWalletPass["syncStatus"];
  consent_version: number;
  consented_at: string;
  current_revision: number;
  current_snapshot_hash: string;
  current_snapshot: Record<string, unknown> | null;
  issued_at: string;
  revoked_at: string | null;
  last_sync_attempted_at: string | null;
  last_synced_at: string | null;
  last_sync_error_code: string | null;
  last_sync_error_at: string | null;
  created_at: string;
  updated_at: string;
};

type WalletPassRevisionRow = {
  id: string;
  pass_id: string;
  revision: number;
  snapshot_hash: string;
  snapshot: Record<string, unknown> | null;
  consent_version: number;
  consented_at: string;
  issued_at: string;
  created_at: string;
};

type AppleWalletDeviceRegistrationRow = {
  id: string;
  pass_id: string;
  device_library_identifier_hash: string;
  push_token_ciphertext: string;
  push_token_iv: string;
  push_token_auth_tag: string;
  push_token_key_version: number;
  last_registered_at: string;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
};

type WalletPassRpcRow = Omit<WalletPassRow, "id"> & {
  pass_id: string;
};

type IssueWalletPassRpcRow = WalletPassRpcRow & {
  is_new_pass: boolean;
  is_new_revision: boolean;
  operation_created: boolean;
};

type RevokeWalletPassRpcRow = WalletPassRpcRow & {
  already_revoked: boolean;
  operation_created: boolean;
};

type RegisterAppleWalletDeviceRpcRow = WalletPassRpcRow & {
  registration_id: string;
  device_library_identifier_hash: string;
  push_token_ciphertext: string;
  push_token_iv: string;
  push_token_auth_tag: string;
  push_token_key_version: number;
  last_registered_at: string;
  removed_at: string | null;
  registration_created_at: string;
  registration_updated_at: string;
  is_new_registration: boolean;
};

type UnregisterAppleWalletDeviceRpcRow = WalletPassRpcRow & {
  removed: boolean;
};

function toRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function toWalletPass(row: WalletPassRow): MemberWalletPass {
  return {
    id: row.id,
    memberId: row.member_id,
    platform: row.platform,
    publicId: row.public_id,
    serialNumber: row.serial_number,
    credentialStatus: row.credential_status,
    installationStatus: row.installation_status,
    syncStatus: row.sync_status,
    consentVersion: row.consent_version,
    consentedAt: row.consented_at,
    currentRevision: row.current_revision,
    currentSnapshotHash: row.current_snapshot_hash,
    currentSnapshot: toRecord(row.current_snapshot),
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    lastSyncAttemptedAt: row.last_sync_attempted_at,
    lastSyncedAt: row.last_synced_at,
    lastSyncErrorCode: row.last_sync_error_code,
    lastSyncErrorAt: row.last_sync_error_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWalletPassFromRpc(row: WalletPassRpcRow): MemberWalletPass {
  return toWalletPass({ ...row, id: row.pass_id });
}

function toWalletPassRevision(row: WalletPassRevisionRow): MemberWalletPassRevision {
  return {
    id: row.id,
    passId: row.pass_id,
    revision: row.revision,
    snapshotHash: row.snapshot_hash,
    snapshot: toRecord(row.snapshot),
    consentVersion: row.consent_version,
    consentedAt: row.consented_at,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
  };
}

function toAppleWalletDeviceRegistration(
  row: AppleWalletDeviceRegistrationRow,
): AppleWalletDeviceRegistration {
  return {
    id: row.id,
    passId: row.pass_id,
    deviceLibraryIdentifierHash: row.device_library_identifier_hash,
    pushTokenCiphertext: row.push_token_ciphertext,
    pushTokenIv: row.push_token_iv,
    pushTokenAuthTag: row.push_token_auth_tag,
    pushTokenKeyVersion: row.push_token_key_version,
    lastRegisteredAt: row.last_registered_at,
    removedAt: row.removed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCurrentRevision(
  passId: string,
  revision: number,
): Promise<MemberWalletPassRevision> {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_wallet_pass_revisions")
    .select(
      "id,pass_id,revision,snapshot_hash,snapshot,consent_version,consented_at,issued_at,created_at",
    )
    .eq("pass_id", passId)
    .eq("revision", revision)
    .maybeSingle();
  if (error || !data) {
    throw new Error("member_wallet_pass_revision_missing");
  }
  return toWalletPassRevision(data as WalletPassRevisionRow);
}

export class SupabaseWalletPassRepository implements WalletPassRepository {
  async getWalletPassByPublicId(publicId: string) {
    const { data, error } = await getSupabaseAdminClient()
      .from("member_wallet_passes")
      .select(
        "id,member_id,platform,public_id,serial_number,credential_status,installation_status,sync_status,consent_version,consented_at,current_revision,current_snapshot_hash,current_snapshot,issued_at,revoked_at,last_sync_attempted_at,last_synced_at,last_sync_error_code,last_sync_error_at,created_at,updated_at",
      )
      .eq("public_id", publicId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? toWalletPass(data as WalletPassRow) : null;
  }

  async getAppleWalletPassBySerialNumber(serialNumber: string) {
    const { data, error } = await getSupabaseAdminClient()
      .from("member_wallet_passes")
      .select(
        "id,member_id,platform,public_id,serial_number,credential_status,installation_status,sync_status,consent_version,consented_at,current_revision,current_snapshot_hash,current_snapshot,issued_at,revoked_at,last_sync_attempted_at,last_synced_at,last_sync_error_code,last_sync_error_at,created_at,updated_at",
      )
      .eq("platform", "apple")
      .eq("serial_number", serialNumber)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? toWalletPass(data as WalletPassRow) : null;
  }

  async getMemberWalletPass(input: {
    memberId: string;
    platform: WalletPassPlatform;
  }) {
    const { data, error } = await getSupabaseAdminClient()
      .from("member_wallet_passes")
      .select(
        "id,member_id,platform,public_id,serial_number,credential_status,installation_status,sync_status,consent_version,consented_at,current_revision,current_snapshot_hash,current_snapshot,issued_at,revoked_at,last_sync_attempted_at,last_synced_at,last_sync_error_code,last_sync_error_at,created_at,updated_at",
      )
      .eq("member_id", input.memberId)
      .eq("platform", input.platform)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? toWalletPass(data as WalletPassRow) : null;
  }

  async listAppleWalletDeviceRegistrationsForPass(passId: string) {
    const { data, error } = await getSupabaseAdminClient()
      .from("apple_wallet_device_registrations")
      .select(
        "id,pass_id,device_library_identifier_hash,push_token_ciphertext,push_token_iv,push_token_auth_tag,push_token_key_version,last_registered_at,removed_at,created_at,updated_at",
      )
      .eq("pass_id", passId)
      .is("removed_at", null)
      .order("updated_at", { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as AppleWalletDeviceRegistrationRow[]).map(
      toAppleWalletDeviceRegistration,
    );
  }

  async listAppleWalletPassesForReconciliation(input: {
    afterPassId?: string | null;
    limit: number;
  }) {
    let query = getSupabaseAdminClient()
      .from("member_wallet_passes")
      .select(
        "id,member_id,platform,public_id,serial_number,credential_status,installation_status,sync_status,consent_version,consented_at,current_revision,current_snapshot_hash,current_snapshot,issued_at,revoked_at,last_sync_attempted_at,last_synced_at,last_sync_error_code,last_sync_error_at,created_at,updated_at",
      )
      .eq("platform", "apple")
      .eq("installation_status", "installed")
      .or("credential_status.eq.active,sync_status.in.(pending,failed)")
      .order("id", { ascending: true })
      .limit(Math.max(1, input.limit));
    if (input.afterPassId) {
      query = query.gt("id", input.afterPassId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as WalletPassRow[]).map(toWalletPass);
  }

  async issueMemberWalletPass(
    input: IssueMemberWalletPassInput,
  ): Promise<IssueMemberWalletPassResult> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "issue_member_wallet_pass",
      {
        p_member_id: input.memberId,
        p_platform: input.platform,
        p_consent_version: input.consentVersion,
        p_consented_at: input.consentedAt,
        p_snapshot_hash: input.snapshotHash,
        p_snapshot: input.snapshot,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      },
    );
    if (error) {
      throw new Error(error.message);
    }
    const row = (Array.isArray(data) ? data[0] : data) as IssueWalletPassRpcRow | null;
    if (!row) {
      throw new Error("member_wallet_pass_operation_result_missing");
    }
    return {
      pass: toWalletPassFromRpc(row),
      revision: await getCurrentRevision(row.pass_id, row.current_revision),
      isNewPass: row.is_new_pass,
      isNewRevision: row.is_new_revision,
      operationCreated: row.operation_created,
    };
  }

  async revokeMemberWalletPass(
    input: RevokeMemberWalletPassInput,
  ): Promise<RevokeMemberWalletPassResult> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "revoke_member_wallet_pass",
      {
        p_member_id: input.memberId,
        p_platform: input.platform,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_reason: input.reason,
      },
    );
    if (error) {
      throw new Error(error.message);
    }
    const row = (Array.isArray(data) ? data[0] : data) as RevokeWalletPassRpcRow | null;
    if (!row) {
      throw new Error("member_wallet_pass_operation_result_missing");
    }
    return {
      pass: toWalletPassFromRpc(row),
      alreadyRevoked: row.already_revoked,
      operationCreated: row.operation_created,
    };
  }

  async registerAppleWalletDevice(
    input: RegisterAppleWalletDeviceInput,
  ): Promise<RegisterAppleWalletDeviceResult> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "register_apple_wallet_device",
      {
        p_public_id: input.publicId,
        p_device_library_identifier_hash: input.deviceLibraryIdentifierHash,
        p_push_token_ciphertext: input.pushTokenCiphertext,
        p_push_token_iv: input.pushTokenIv,
        p_push_token_auth_tag: input.pushTokenAuthTag,
        p_push_token_key_version: input.pushTokenKeyVersion,
      },
    );
    if (error) {
      throw new Error(error.message);
    }
    const row = (Array.isArray(data) ? data[0] : data) as RegisterAppleWalletDeviceRpcRow | null;
    if (!row) {
      throw new Error("apple_wallet_device_registration_failed");
    }
    return {
      pass: toWalletPassFromRpc(row),
      registration: {
        id: row.registration_id,
        passId: row.pass_id,
        deviceLibraryIdentifierHash: row.device_library_identifier_hash,
        pushTokenCiphertext: row.push_token_ciphertext,
        pushTokenIv: row.push_token_iv,
        pushTokenAuthTag: row.push_token_auth_tag,
        pushTokenKeyVersion: row.push_token_key_version,
        lastRegisteredAt: row.last_registered_at,
        removedAt: row.removed_at,
        createdAt: row.registration_created_at,
        updatedAt: row.registration_updated_at,
      },
      isNewRegistration: row.is_new_registration,
    };
  }

  async unregisterAppleWalletDevice(
    input: UnregisterAppleWalletDeviceInput,
  ): Promise<UnregisterAppleWalletDeviceResult> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "unregister_apple_wallet_device",
      {
        p_public_id: input.publicId,
        p_device_library_identifier_hash: input.deviceLibraryIdentifierHash,
      },
    );
    if (error) {
      throw new Error(error.message);
    }
    const row = (Array.isArray(data) ? data[0] : data) as UnregisterAppleWalletDeviceRpcRow | null;
    if (!row) {
      throw new Error("member_wallet_pass_operation_result_missing");
    }
    return {
      pass: toWalletPassFromRpc(row),
      removed: row.removed,
    };
  }

  async listUpdatedAppleWalletPasses(input: {
    deviceLibraryIdentifierHash: string;
    updatedSince?: string | null;
    limit: number;
  }): Promise<UpdatedAppleWalletPass[]> {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "list_updated_apple_wallet_passes",
      {
        p_device_library_identifier_hash: input.deviceLibraryIdentifierHash,
        p_updated_since: input.updatedSince ?? null,
        p_limit: input.limit,
      },
    );
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data ?? []) as WalletPassRpcRow[];
    const passIds = rows.map((row) => row.pass_id);
    const registrationResult = passIds.length
      ? await getSupabaseAdminClient()
          .from("apple_wallet_device_registrations")
          .select(
            "id,pass_id,device_library_identifier_hash,push_token_ciphertext,push_token_iv,push_token_auth_tag,push_token_key_version,last_registered_at,removed_at,created_at,updated_at",
          )
          .in("pass_id", passIds)
          .eq(
            "device_library_identifier_hash",
            input.deviceLibraryIdentifierHash,
          )
          .is("removed_at", null)
      : { data: [], error: null };
    if (registrationResult.error) {
      throw new Error(registrationResult.error.message);
    }
    const registrationsByPassId = new Map<string, AppleWalletDeviceRegistration[]>();
    for (const row of (registrationResult.data ?? []) as AppleWalletDeviceRegistrationRow[]) {
      const items = registrationsByPassId.get(row.pass_id) ?? [];
      items.push(toAppleWalletDeviceRegistration(row));
      registrationsByPassId.set(row.pass_id, items);
    }
    return rows.map((row) => ({
      pass: toWalletPassFromRpc(row),
      registrations: registrationsByPassId.get(row.pass_id) ?? [],
    }));
  }

  async markWalletPassSyncSuccess(input: {
    passId: string;
    syncedAt?: string | null;
  }) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const { data, error } = await getSupabaseAdminClient()
      .from("member_wallet_passes")
      .update({
        sync_status: "synced",
        last_sync_attempted_at: timestamp,
        last_synced_at: timestamp,
        last_sync_error_code: null,
        last_sync_error_at: null,
      })
      .eq("id", input.passId)
      .select(
        "id,member_id,platform,public_id,serial_number,credential_status,installation_status,sync_status,consent_version,consented_at,current_revision,current_snapshot_hash,current_snapshot,issued_at,revoked_at,last_sync_attempted_at,last_synced_at,last_sync_error_code,last_sync_error_at,created_at,updated_at",
      )
      .maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? "member_wallet_pass_not_found");
    }
    return toWalletPass(data as WalletPassRow);
  }

  async markWalletPassSyncFailure(input: {
    passId: string;
    safeErrorCode: string;
    attemptedAt?: string | null;
  }) {
    const timestamp = input.attemptedAt ?? new Date().toISOString();
    const { data, error } = await getSupabaseAdminClient()
      .from("member_wallet_passes")
      .update({
        sync_status: "failed",
        last_sync_attempted_at: timestamp,
        last_sync_error_code: input.safeErrorCode,
        last_sync_error_at: timestamp,
      })
      .eq("id", input.passId)
      .select(
        "id,member_id,platform,public_id,serial_number,credential_status,installation_status,sync_status,consent_version,consented_at,current_revision,current_snapshot_hash,current_snapshot,issued_at,revoked_at,last_sync_attempted_at,last_synced_at,last_sync_error_code,last_sync_error_at,created_at,updated_at",
      )
      .maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? "member_wallet_pass_not_found");
    }
    return toWalletPass(data as WalletPassRow);
  }

  async reconcileWalletPassContent(input: ReconcileWalletPassContentInput) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "reconcile_member_wallet_pass_content",
      {
        p_pass_id: input.passId,
        p_action: input.action,
        p_snapshot_hash:
          input.action === "refresh" ? input.snapshotHash : null,
        p_snapshot: input.action === "refresh" ? input.snapshot : null,
        p_changed_at: input.changedAt ?? null,
      },
    );
    const row = (data?.[0] ?? null) as WalletPassRpcRow | null;
    if (error || !row) {
      throw new Error(error?.message ?? "member_wallet_pass_not_found");
    }
    return toWalletPassFromRpc(row);
  }
}
