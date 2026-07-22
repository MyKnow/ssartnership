import { getConfiguredBackfillableSsafyYears, getSsafyCycleSettings } from "@/lib/ssafy-cycle-settings";
import { getMemberProfileSyncFailureCode } from "@/lib/member-profile-sync-errors";
import {
  syncMemberMattermostProfile,
} from "@/lib/member-mattermost-profile-sync";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  type MemberSyncAuditResult,
  type MemberMattermostUnavailableResult,
  type MemberSyncBatchResult,
  type MemberSyncFailure,
  type MemberSyncResult,
  wrapMmMemberSyncDbError,
} from "./shared";
import {
  DEFAULT_MEMBER_SYNC_BATCH_SIZE,
  type MemberSyncBatchOptions,
} from "./batch";

const DATABASE_WRITE_CONCURRENCY = 8;

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
      providerRequestId: null,
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

function chunk<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadBackfillMemberIds(
  generations: readonly number[],
  options: MemberSyncBatchOptions,
) {
  let query = getSupabaseAdminClient()
    .from("members")
    .select("id")
    .in("generation", generations)
    .is("deleted_at", null)
    .is("mattermost_login_disabled_at", null)
    .order("id", { ascending: true })
    .limit(options.limit + 1);
  if (options.cursor) {
    query = query.gt("id", options.cursor);
  }

  const { data, error } = await query;
  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }
  const ids = (data ?? [])
    .map((row) => typeof row.id === "string" ? row.id : null)
    .filter((id): id is string => id !== null);
  return {
    memberIds: ids.slice(0, options.limit),
    hasMore: ids.length > options.limit,
  };
}

function toAuditFromSyncResult(result: MemberSyncResult): MemberSyncAuditResult {
  return {
    member: result.member,
    status: result.imageSkipped
      ? "photo_skipped"
      : result.updated
        ? "updated"
        : "unchanged",
    changedFields: result.changedFields,
    imageSkipped: result.imageSkipped,
    lifecycleStatus: "active",
    detailCode: "MM_USER_ACTIVE",
    providerRequestId: null,
    transitionReason: null,
    reason: null,
    lifecycle: null,
  };
}

function toAuditFromUnavailable(result: MemberMattermostUnavailableResult): MemberSyncAuditResult {
  return {
    member: result.member,
    status: result.lifecycleStatus,
    changedFields: [],
    imageSkipped: false,
    lifecycleStatus: result.lifecycleStatus,
    detailCode: result.detailCode,
    providerRequestId: null,
    transitionReason: result.transitionReason,
    reason: null,
    lifecycle: null,
  };
}

export async function syncMembersBySelectableYears(
  options: MemberSyncBatchOptions = {
    limit: DEFAULT_MEMBER_SYNC_BATCH_SIZE,
    cursor: null,
  },
): Promise<MemberSyncBatchResult> {
  const cycleSettings = await getSsafyCycleSettings();
  const generations = getConfiguredBackfillableSsafyYears(cycleSettings);
  const { memberIds, hasMore } = await loadBackfillMemberIds(generations, options);
  const results: MemberSyncResult[] = [];
  const photoSkipped: MemberSyncResult[] = [];
  const mattermostUnavailable: MemberMattermostUnavailableResult[] = [];
  const failures: MemberSyncFailure[] = [];
  const auditResults: MemberSyncAuditResult[] = [];
  let skipped = 0;

  for (const ids of chunk(memberIds, DATABASE_WRITE_CONCURRENCY)) {
    const settled = await Promise.allSettled(ids.map((memberId) => syncMemberById(memberId)));
    for (let index = 0; index < settled.length; index += 1) {
      const item = settled[index];
      const memberId = ids[index] ?? "unknown";
      if (item.status === "rejected") {
        failures.push({
          memberId,
          mmUserId: null,
          reason: getMemberProfileSyncFailureCode(item.reason),
        });
        continue;
      }
      const result = item.value;
      if (!result) {
        skipped += 1;
        continue;
      }
      if ("snapshot" in result) {
        auditResults.push(toAuditFromSyncResult(result));
        if (result.updated) {
          results.push(result);
        }
        if (result.imageSkipped) {
          photoSkipped.push(result);
        }
        if (!result.updated && !result.imageSkipped) {
          skipped += 1;
        }
        continue;
      }

      mattermostUnavailable.push(result);
      auditResults.push(toAuditFromUnavailable(result));
    }
  }

  return {
    checked: memberIds.length,
    updated: results.length,
    skipped,
    hasMore,
    nextCursor: hasMore ? memberIds.at(-1) ?? options.cursor : null,
    results,
    photoSkipped,
    mattermostUnavailable,
    failures,
    auditResults,
  };
}
