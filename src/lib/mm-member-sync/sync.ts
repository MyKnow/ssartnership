import { syncMemberMattermostProfile } from "@/lib/member-mattermost-profile-sync";
import {
  getConfiguredBackfillableSsafyYears,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  type MemberSyncBatchResult,
  type MemberMattermostUnavailableResult,
  type MemberSyncResult,
  wrapMmMemberSyncDbError,
} from "./shared";

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
    return { member: result.member };
  }

  return {
    member: result.member,
    snapshot: result.snapshot,
    updated: result.updated,
    changedFields: result.changedFields,
  };
}

export async function syncMembersBySelectableYears(): Promise<MemberSyncBatchResult> {
  const cycleSettings = await getSsafyCycleSettings();
  const generations = getConfiguredBackfillableSsafyYears(cycleSettings);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .in("generation", generations)
    .is("deleted_at", null)
    .is("mattermost_login_disabled_at", null)
    .order("generation", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }

  const memberIds = (data ?? [])
    .map((member) => member.id as string | null)
    .filter((memberId): memberId is string => Boolean(memberId));
  const results: MemberSyncResult[] = [];
  const mattermostUnavailable: MemberMattermostUnavailableResult[] = [];
  const failures: MemberSyncBatchResult["failures"] = [];

  for (const memberId of memberIds) {
    try {
      const result = await syncMemberById(memberId);
      if (!result) {
        failures.push({
          memberId,
          mmUserId: null,
          reason: "SSAFY Verify 프로필을 찾을 수 없습니다.",
        });
        continue;
      }
      if (!("snapshot" in result)) {
        mattermostUnavailable.push(result);
        continue;
      }
      if (result.updated) {
        results.push(result);
      }
    } catch {
      failures.push({
        memberId,
        mmUserId: null,
        reason: "MM 동기화 실패",
      });
    }
  }

  return {
    checked: memberIds.length,
    updated: results.length,
    skipped: memberIds.length - results.length - failures.length - mattermostUnavailable.length,
    results,
    mattermostUnavailable,
    failures,
  };
}

export { fetchMemberSnapshotByUserId } from "./snapshot";
