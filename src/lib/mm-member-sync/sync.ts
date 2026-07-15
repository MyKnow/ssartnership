import { extractSsafyVerifyMemberProfiles, toMemberSyncSnapshot } from "@/lib/ssafy-verify/profile";
import {
  SsafyVerifyServerApiError,
  type SsafyVerifyServerApiClient,
} from "@/lib/ssafy-verify/server-api";
import { getConfiguredBackfillableSsafyYears, getSsafyCycleSettings } from "@/lib/ssafy-cycle-settings";
import { markMemberMattermostLoginUnavailable } from "@/lib/member-email-login-transition";
import { getMemberProfileSyncFailureCode } from "@/lib/member-profile-sync-errors";
import {
  applyMattermostProfileSnapshot,
  getMemberSyncSubject,
  resolveLocalStaffRole,
  syncMemberMattermostProfile,
  type MattermostDirectoryRow,
  type MemberMattermostSyncRow,
} from "@/lib/member-mattermost-profile-sync";
import { createMemberSyncApiClient } from "./snapshot";
import {
  parseMattermostLifecycleBatch,
  resolveMattermostLifecycle,
  type MattermostLifecycleResult,
} from "./lifecycle";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { MemberProfileSyncError } from "@/lib/member-profile-sync-errors";
import {
  type MemberSyncAuditResult,
  type MemberMattermostUnavailableResult,
  type MemberSyncBatchResult,
  type MemberSyncFailure,
  type MemberSyncResult,
  wrapMmMemberSyncDbError,
} from "./shared";

const PROFILE_BATCH_SIZE = 500;
const DATABASE_WRITE_CONCURRENCY = 8;

type BatchMemberRow = MemberMattermostSyncRow & {
  directory: MattermostDirectoryRow | MattermostDirectoryRow[] | null;
};

type BatchProfileState = {
  profiles: Map<string, ReturnType<typeof toMemberSyncSnapshot>>;
  requestId: string | null;
  error: unknown | null;
};

type BatchLifecycleState = {
  results: Map<string, MattermostLifecycleResult>;
  requestId: string | null;
  error: unknown | null;
};

type BatchTargetProcessResult = {
  syncResult: MemberSyncResult | null;
  unavailable: MemberMattermostUnavailableResult | null;
  failure: MemberSyncFailure | null;
  audit: MemberSyncAuditResult;
};

function buildMemberSyncSummary(result: MemberSyncResult) {
  const labels: Record<MemberSyncResult["changedFields"][number], string> = {
    mmUsername: "MM 아이디",
    displayName: "이름",
    track: "트랙",
    avatar: "프로필 사진",
  };
  const changedLabels = result.changedFields.map((field) => labels[field]);
  return [
    `@${result.snapshot.mmUsername}`,
    ...(changedLabels.length > 0 ? [changedLabels.join(", ")] : []),
  ].join(" / ");
}

export function buildMemberSyncLogProperties(
  result: MemberSyncResult,
  extra: Record<string, unknown> = {},
) {
  return {
    mmUserId: result.member.mmUserId,
    generation: result.member.generation,
    summary: buildMemberSyncSummary(result),
    changedFields: result.changedFields,
    imageSkipped: result.imageSkipped,
    ...extra,
  };
}

export function buildMemberSyncAuditLogProperties(
  audit: MemberSyncAuditResult,
  extra: Record<string, unknown> = {},
) {
  return {
    mmUserId: audit.member.mmUserId,
    generation: audit.member.generation,
    status: audit.status,
    changedFields: audit.changedFields,
    imageSkipped: audit.imageSkipped,
    lifecycleStatus: audit.lifecycleStatus,
    detailCode: audit.detailCode,
    providerRequestId: audit.providerRequestId,
    transitionReason: audit.transitionReason,
    reason: audit.reason,
    ...(audit.lifecycle?.username ? { providerUsername: audit.lifecycle.username } : {}),
    ...extra,
  };
}

export async function syncMemberById(
  memberId: string,
): Promise<MemberSyncResult | MemberMattermostUnavailableResult | null> {
  const result = await syncMemberMattermostProfile(memberId);
  if (!result) {
    return null;
  }
  if (!("snapshot" in result)) {
    return {
      member: result.member,
      lifecycleStatus: result.lifecycleStatus,
      detailCode: result.detailCode,
      providerRequestId: result.providerRequestId,
      transitionReason: result.transitionReason,
    };
  }

  return {
    member: result.member,
    snapshot: result.snapshot,
    updated: result.updated,
    changedFields: result.changedFields,
    imageSkipped: result.imageSkipped,
  };
}

function readRequestId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>).request_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getDirectoryRow(
  value: BatchMemberRow["directory"],
): MattermostDirectoryRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.id && row.mm_user_id && row.mm_username
    ? row
    : null;
}

function parseProfileBatch(
  payload: unknown,
  requestedIds: readonly string[],
): BatchProfileState {
  const requestId = readRequestId(payload);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MemberProfileSyncError("provider_response_invalid");
  }
  const data = (payload as Record<string, unknown>).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MemberProfileSyncError("provider_response_invalid");
  }
  const profiles = (data as Record<string, unknown>).profiles;
  if (!Array.isArray(profiles)) {
    throw new MemberProfileSyncError("provider_response_invalid");
  }

  const requested = new Set(requestedIds);
  const profileMap = new Map<string, ReturnType<typeof toMemberSyncSnapshot>>();
  for (const profile of extractSsafyVerifyMemberProfiles(payload)) {
    if (!requested.has(profile.mattermostUserId)) {
      throw new MemberProfileSyncError("identity_mismatch");
    }
    profileMap.set(profile.mattermostUserId, toMemberSyncSnapshot(profile));
  }
  return { profiles: profileMap, requestId, error: null };
}

function errorRequestId(error: unknown) {
  return error instanceof SsafyVerifyServerApiError ? error.requestId : null;
}

function errorReason(error: unknown, fallback: string) {
  if (error instanceof MemberProfileSyncError) {
    return getMemberProfileSyncFailureCode(error);
  }
  if (error instanceof SsafyVerifyServerApiError) {
    return getMemberProfileSyncFailureCode(error);
  }
  return fallback;
}

function errorDetailCode(error: unknown) {
  if (error instanceof SsafyVerifyServerApiError) {
    return error.errorCode;
  }
  if (error instanceof MemberProfileSyncError) {
    return error.code;
  }
  return null;
}

async function fetchBatchStates(
  client: SsafyVerifyServerApiClient,
  mattermostUserIds: readonly string[],
): Promise<{ profile: BatchProfileState; lifecycle: BatchLifecycleState }> {
  const [profileSettled, lifecycleSettled] = await Promise.allSettled([
    client.getMattermostUserProfilesBatch(mattermostUserIds),
    client.getMattermostUserLifecyclesBatch(mattermostUserIds),
  ]);

  const profile: BatchProfileState = profileSettled.status === "fulfilled"
    ? (() => {
        try {
          return parseProfileBatch(profileSettled.value, mattermostUserIds);
        } catch (error) {
          return {
            profiles: new Map(),
            requestId: readRequestId(profileSettled.value),
            error,
          };
        }
      })()
    : {
        profiles: new Map(),
        requestId: errorRequestId(profileSettled.reason),
        error: profileSettled.reason,
      };
  const lifecycle: BatchLifecycleState = lifecycleSettled.status === "fulfilled"
    ? (() => {
        try {
          const parsed = parseMattermostLifecycleBatch(
            lifecycleSettled.value,
            mattermostUserIds,
          );
          return {
            results: parsed.results,
            requestId: parsed.requestId,
            error: null,
          };
        } catch (error) {
          return {
            results: new Map(),
            requestId: readRequestId(lifecycleSettled.value),
            error,
          };
        }
      })()
    : {
        results: new Map(),
        requestId: errorRequestId(lifecycleSettled.reason),
        error: lifecycleSettled.reason,
      };

  return { profile, lifecycle };
}

async function processBatchTarget(input: {
  target: { member: MemberMattermostSyncRow; directory: MattermostDirectoryRow };
  profile: ReturnType<typeof toMemberSyncSnapshot> | null;
  profileState: BatchProfileState;
  lifecycle: MattermostLifecycleResult | null;
  lifecycleState: BatchLifecycleState;
}): Promise<BatchTargetProcessResult> {
  const { target, profile, profileState, lifecycle, lifecycleState } = input;
  const { member, directory } = target;
  const subject = getMemberSyncSubject(member, directory);
  const isStaff = resolveLocalStaffRole(member, directory);
  const resolution = isStaff === null
    ? {
        lifecycleStatus: "unresolved" as const,
        transitionReason: null,
        detailCode: "PARTNER_MEMBER_ROLE_UNRESOLVED",
      }
    : resolveMattermostLifecycle({ result: lifecycle, isStaff });
  const providerRequestId = lifecycle?.requestId
    ?? lifecycleState.requestId
    ?? errorRequestId(lifecycleState.error);

  if (resolution.transitionReason) {
    try {
      await markMemberMattermostLoginUnavailable({
        memberId: member.id,
        reason: resolution.transitionReason,
      });
    } catch (error) {
      const reason = errorReason(error, "member_sync_transition_failed");
      return {
        syncResult: null,
        unavailable: null,
        failure: {
          memberId: member.id,
          mmUserId: directory.mm_user_id,
          reason,
          detailCode: resolution.detailCode,
          providerRequestId,
        },
        audit: {
          member: subject,
          status: "failed",
          changedFields: [],
          imageSkipped: false,
          lifecycleStatus: resolution.lifecycleStatus,
          detailCode: resolution.detailCode,
          providerRequestId,
          transitionReason: resolution.transitionReason,
          reason,
          lifecycle,
        },
      };
    }

    const unavailable: MemberMattermostUnavailableResult = {
      member: subject,
      lifecycleStatus: resolution.lifecycleStatus === "departed" ? "departed" : "graduated",
      detailCode: resolution.detailCode,
      providerRequestId,
      transitionReason: resolution.transitionReason,
    };
    return {
      syncResult: null,
      unavailable,
      failure: null,
      audit: {
        member: subject,
        status: resolution.lifecycleStatus === "departed" ? "departed" : "graduated",
        changedFields: [],
        imageSkipped: false,
        lifecycleStatus: resolution.lifecycleStatus,
        detailCode: resolution.detailCode,
        providerRequestId,
        transitionReason: resolution.transitionReason,
        reason: null,
        lifecycle,
      },
    };
  }

  if (!profile) {
    const providerError = profileState.error ?? lifecycleState.error;
    const reason = providerError
      ? errorReason(providerError, "member_sync_provider_unavailable")
      : resolution.detailCode;
    const detailCode = errorDetailCode(providerError) ?? resolution.detailCode;
    const failure: MemberSyncFailure = {
      memberId: member.id,
      mmUserId: directory.mm_user_id,
      reason,
      detailCode,
      providerRequestId:
        providerRequestId
        ?? errorRequestId(profileState.error)
        ?? errorRequestId(lifecycleState.error),
    };
    return {
      syncResult: null,
      unavailable: null,
      failure,
      audit: {
        member: subject,
        status: "unresolved",
        changedFields: [],
        imageSkipped: false,
        lifecycleStatus: resolution.lifecycleStatus,
        detailCode,
        providerRequestId: failure.providerRequestId ?? null,
        transitionReason: null,
        reason,
        lifecycle,
      },
    };
  }

  let syncResult: MemberSyncResult;
  try {
    syncResult = await applyMattermostProfileSnapshot({
      member,
      directory,
      snapshot: profile,
    });
  } catch (error) {
    const reason = errorReason(error, "member_sync_failed");
    const detailCode = errorDetailCode(error) ?? resolution.detailCode;
    return {
      syncResult: null,
      unavailable: null,
      failure: {
        memberId: member.id,
        mmUserId: directory.mm_user_id,
        reason,
        detailCode,
        providerRequestId: providerRequestId ?? errorRequestId(profileState.error),
      },
      audit: {
        member: subject,
        status: "failed",
        changedFields: [],
        imageSkipped: false,
        lifecycleStatus: resolution.lifecycleStatus,
        detailCode,
        providerRequestId: providerRequestId ?? errorRequestId(profileState.error),
        transitionReason: null,
        reason,
        lifecycle,
      },
    };
  }

  const status = syncResult.imageSkipped
    ? "photo_skipped" as const
    : syncResult.updated
      ? "updated" as const
      : "unchanged" as const;
  const lifecycleFailure = lifecycleState.error
    ? errorReason(lifecycleState.error, "member_sync_provider_unavailable")
    : resolution.lifecycleStatus === "unresolved"
      ? resolution.detailCode
      : null;
  const lifecycleDetailCode = errorDetailCode(lifecycleState.error) ?? resolution.detailCode;
  return {
    syncResult,
    unavailable: null,
    failure: lifecycleFailure
      ? {
          memberId: member.id,
          mmUserId: directory.mm_user_id,
          reason: lifecycleFailure,
          detailCode: lifecycleDetailCode,
          providerRequestId,
        }
      : null,
    audit: {
      member: syncResult.member,
      status,
      changedFields: syncResult.changedFields,
      imageSkipped: syncResult.imageSkipped,
      lifecycleStatus: resolution.lifecycleStatus,
      detailCode: lifecycleFailure ? lifecycleDetailCode : resolution.detailCode,
      providerRequestId,
      transitionReason: null,
      reason: lifecycleFailure,
      lifecycle,
    },
  };
}

function chunk<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadBackfillTargets(generations: readonly number[]) {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select(
      "id,display_name,generation,mattermost_account_id,directory:mm_user_directory!members_mattermost_account_id_fkey(id,mm_user_id,mm_username,is_staff)",
    )
    .in("generation", generations)
    .is("deleted_at", null)
    .is("mattermost_login_disabled_at", null)
    .order("generation", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }

  const valid: Array<{ member: MemberMattermostSyncRow; directory: MattermostDirectoryRow }> = [];
  const invalid: MemberSyncFailure[] = [];
  for (const row of (data ?? []) as BatchMemberRow[]) {
    const directory = getDirectoryRow(row.directory);
    if (!directory) {
      invalid.push({
        memberId: row.id,
        mmUserId: null,
        reason: "member_sync_directory_failed",
      });
      continue;
    }
    valid.push({
      member: {
        id: row.id,
        display_name: row.display_name,
        generation: row.generation,
        mattermost_account_id: row.mattermost_account_id,
      },
      directory,
    });
  }
  return { valid, invalid, checked: (data ?? []).length };
}

export async function syncMembersBySelectableYears(): Promise<MemberSyncBatchResult> {
  const cycleSettings = await getSsafyCycleSettings();
  const generations = getConfiguredBackfillableSsafyYears(cycleSettings);
  const loaded = await loadBackfillTargets(generations);
  const results: MemberSyncResult[] = [];
  const photoSkipped: MemberSyncResult[] = [];
  const mattermostUnavailable: MemberMattermostUnavailableResult[] = [];
  const failures: MemberSyncFailure[] = [...loaded.invalid];
  const auditResults: MemberSyncAuditResult[] = [];
  let skipped = 0;

  for (const targets of chunk(loaded.valid, PROFILE_BATCH_SIZE)) {
    const ids = targets.map((target) => target.directory.mm_user_id);
    const client = createMemberSyncApiClient({
      identifier: "manual_backfill",
      flow: "member_profile_backfill",
      mattermostUserIds: ids,
    });
    const states = await fetchBatchStates(client, ids);
    const profiles = states.profile.profiles;
    const lifecycles = states.lifecycle.results;
    for (const targetChunk of chunk(targets, DATABASE_WRITE_CONCURRENCY)) {
      const processed = await Promise.allSettled(
        targetChunk.map((target) => processBatchTarget({
          target,
          profile: profiles.get(target.directory.mm_user_id) ?? null,
          profileState: states.profile,
          lifecycle: lifecycles.get(target.directory.mm_user_id) ?? null,
          lifecycleState: states.lifecycle,
        })),
      );
      for (const item of processed) {
        if (item.status === "rejected") {
          failures.push({
            memberId: "unknown",
            mmUserId: null,
            reason: errorReason(item.reason, "member_sync_failed"),
          });
          continue;
        }
        const result = item.value;
        auditResults.push(result.audit);
        if (result.syncResult) {
          if (result.syncResult.updated) {
            results.push(result.syncResult);
          }
          if (result.syncResult.imageSkipped) {
            photoSkipped.push(result.syncResult);
          }
          if (!result.syncResult.updated && !result.syncResult.imageSkipped) {
            skipped += 1;
          }
        }
        if (result.unavailable) {
          mattermostUnavailable.push(result.unavailable);
        }
        if (result.failure) {
          failures.push(result.failure);
        }
      }
    }
  }

  return {
    checked: loaded.checked,
    updated: results.length,
    skipped,
    results,
    photoSkipped,
    mattermostUnavailable,
    failures,
    auditResults,
  };
}

export { fetchMemberSnapshotByUserId } from "./snapshot";
