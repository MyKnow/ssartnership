import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getMemberSyncCandidateYears,
  loadBackfillableMembers,
  loadMemberById,
  resolveMemberSnapshotForYears,
} from "./snapshot";
import {
  type MemberRow,
  type MemberSyncBatchResult,
  type MemberSyncResult,
  type MemberSyncSnapshot,
  type SenderSession,
  wrapMmMemberSyncDbError,
} from "./shared";

function buildMemberSyncSummary(result: MemberSyncResult) {
  const summaryParts = [`@${result.snapshot.mmUsername}`];

  if (result.changes.mmUsername) {
    summaryParts[0] = `@${result.snapshot.mmUsername} (${result.changes.mmUsername})`;
  }
  if (result.changes.displayName) {
    summaryParts.push(`이름 ${result.changes.displayName}`);
  }
  if (result.changes.campus) {
    summaryParts.push(`캠퍼스 ${result.changes.campus}`);
  }
  if (result.changes.avatar) {
    summaryParts.push("프로필 사진 업데이트");
  }

  return summaryParts.join(" / ");
}

type MemberSyncYearBatchResult = {
  results: MemberSyncResult[];
  failures: Array<{ memberId: string; mmUserId: string; reason: string }>;
};

export function buildMemberSyncLogProperties(
  result: MemberSyncResult,
  extra: Record<string, unknown> = {},
) {
  return {
    mmUserId: result.member.mm_user_id,
    year: result.member.year,
    summary: buildMemberSyncSummary(result),
    changedFields: result.changedFields,
    ...result.changes,
    ...extra,
  };
}

export async function syncMemberSnapshot(
  member: MemberRow,
  snapshot: MemberSyncSnapshot,
) {
  const nextCampus = snapshot.campus ?? member.campus ?? null;
  const nextAvatarContentType = snapshot.avatarFetched
    ? snapshot.avatarContentType
    : member.avatar_content_type ?? null;
  const nextAvatarBase64 = snapshot.avatarFetched
    ? snapshot.avatarBase64
    : member.avatar_base64 ?? null;

  const changedFields: Array<"mmUsername" | "displayName" | "campus" | "avatar"> = [];
  const changes: Partial<Record<"mmUsername" | "displayName" | "campus" | "avatar", string>> = {};

  if (member.mm_username !== snapshot.mmUsername) {
    changedFields.push("mmUsername");
    changes.mmUsername = `${member.mm_username} → ${snapshot.mmUsername}`;
  }
  if ((member.display_name ?? null) !== snapshot.displayName) {
    changedFields.push("displayName");
    changes.displayName = `${member.display_name ?? "-"} → ${snapshot.displayName}`;
  }
  if ((member.campus ?? null) !== nextCampus) {
    changedFields.push("campus");
    changes.campus = `${member.campus ?? "-"} → ${nextCampus ?? "-"}`;
  }

  const avatarChanged =
    snapshot.avatarFetched &&
    ((member.avatar_content_type ?? null) !== nextAvatarContentType ||
      (member.avatar_base64 ?? null) !== nextAvatarBase64);
  if (avatarChanged) {
    changedFields.push("avatar");
    changes.avatar = "업데이트";
  }

  if (changedFields.length === 0) {
    return {
      member,
      snapshot,
      updated: false,
      changedFields,
      changes,
    } satisfies MemberSyncResult;
  }

  const updatedAt = new Date().toISOString();
  const nextMember: MemberRow = {
    ...member,
    mm_username: snapshot.mmUsername,
    display_name: snapshot.displayName,
    campus: nextCampus,
    avatar_content_type: nextAvatarContentType,
    avatar_base64: nextAvatarBase64,
    updated_at: updatedAt,
  };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({
      mm_username: nextMember.mm_username,
      display_name: nextMember.display_name,
      campus: nextMember.campus,
      avatar_content_type: nextMember.avatar_content_type,
      avatar_base64: nextMember.avatar_base64,
      updated_at: updatedAt,
    })
    .eq("id", member.id);

  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 저장하지 못했습니다.");
  }

  return {
    member: nextMember,
    snapshot,
    updated: true,
    changedFields,
    changes,
  } satisfies MemberSyncResult;
}

async function syncMembersForYear(
  yearMembers: MemberRow[],
  senderSessionCache: Map<number, Promise<SenderSession>>,
): Promise<MemberSyncYearBatchResult> {
  const results: MemberSyncResult[] = [];
  const failures: Array<{ memberId: string; mmUserId: string; reason: string }> = [];

  for (const member of yearMembers) {
    try {
      const resolved = await resolveMemberSnapshotForYears(
        member,
        getMemberSyncCandidateYears(member.year),
        senderSessionCache,
      );
      if (!resolved) {
        failures.push({
          memberId: member.id,
          mmUserId: member.mm_user_id,
          reason: "MM 사용자 조회 실패",
        });
        continue;
      }

      const result = await syncMemberSnapshot(member, resolved.snapshot);
      if (result.updated) {
        results.push(result);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "MM 동기화 실패";
      failures.push({
        memberId: member.id,
        mmUserId: member.mm_user_id,
        reason,
      });
    }
  }

  return {
    results,
    failures,
  };
}

export async function syncMemberById(
  memberId: string,
): Promise<MemberSyncResult | null> {
  const member = await loadMemberById(memberId);
  if (!member) {
    return null;
  }

  const senderSessionCache = new Map<number, Promise<SenderSession>>();
  const resolved = await resolveMemberSnapshotForYears(
    member,
    getMemberSyncCandidateYears(member.year),
    senderSessionCache,
  );
  if (!resolved) {
    return null;
  }

  return syncMemberSnapshot(member, resolved.snapshot);
}

export async function syncMembersBySelectableYears(): Promise<MemberSyncBatchResult> {
  const { years, members } = await loadBackfillableMembers();

  const results: MemberSyncResult[] = [];
  const failures: Array<{ memberId: string; mmUserId: string; reason: string }> = [];
  const groupedMembers = new Map<number, MemberRow[]>();
  members.forEach((member) => {
    const year = member.year ?? null;
    if (year === null || !years.includes(year)) {
      failures.push({
        memberId: member.id,
        mmUserId: member.mm_user_id,
        reason: "year_missing",
      });
      return;
    }
    const list = groupedMembers.get(year) ?? [];
    list.push(member);
    groupedMembers.set(year, list);
  });

  const senderSessionCache = new Map<number, Promise<SenderSession>>();
  const orderedYears = [...years].sort((a, b) => b - a);
  const yearResults = await Promise.all(
    orderedYears.map((year) =>
      syncMembersForYear(groupedMembers.get(year) ?? [], senderSessionCache),
    ),
  );

  for (const yearResult of yearResults) {
    results.push(...yearResult.results);
    failures.push(...yearResult.failures);
  }

  return {
    checked: members.length,
    updated: results.length,
    skipped: members.length - results.length - failures.length,
    results,
    failures,
  };
}

export { fetchMemberSnapshotByUserId } from "./snapshot";
