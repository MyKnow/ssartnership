import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { getBackfillableSsafyYears } from "@/lib/ssafy-year";
import {
  type MMUser,
  getSenderCredentials,
  getUserById,
  getUserImage,
  loginWithPassword,
} from "@/lib/mattermost";

export type MemberRow = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name?: string | null;
  year: number;
  campus?: string | null;
  class_number?: number | null;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
  updated_at?: string | null;
};

type MemberSyncField = "mmUsername" | "displayName" | "campus" | "classNumber" | "avatar";

export type MemberSyncSnapshot = {
  mmUserId: string;
  mmUsername: string;
  displayName: string;
  campus: string | null;
  classNumber: number | null;
  avatarFetched: boolean;
  avatarContentType: string | null;
  avatarBase64: string | null;
};

export type MemberSyncResult = {
  member: MemberRow;
  snapshot: MemberSyncSnapshot;
  updated: boolean;
  changedFields: MemberSyncField[];
  changes: Partial<Record<MemberSyncField, string>>;
};

export type MemberSyncBatchResult = {
  checked: number;
  updated: number;
  skipped: number;
  results: MemberSyncResult[];
  failures: Array<{ memberId: string; mmUserId: string; reason: string }>;
};

function makeSnapshot(user: MMUser, avatar: { contentType: string; base64: string } | null): MemberSyncSnapshot {
  const profile = parseSsafyProfile(user.nickname ?? user.username);
  const displayName = profile.displayName ?? user.nickname ?? user.username;

  return {
    mmUserId: user.id,
    mmUsername: user.username,
    displayName,
    campus: profile.campus ?? null,
    classNumber: profile.classNumber ?? null,
    avatarFetched: Boolean(avatar),
    avatarContentType: avatar?.contentType ?? null,
    avatarBase64: avatar?.base64 ?? null,
  };
}

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
  if (result.changes.classNumber) {
    summaryParts.push(`반 ${result.changes.classNumber}`);
  }
  if (result.changes.avatar) {
    summaryParts.push("프로필 사진 업데이트");
  }

  return summaryParts.join(" / ");
}

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

export async function fetchMemberSnapshotByUserId(
  token: string,
  userId: string,
): Promise<MemberSyncSnapshot | null> {
  const user = await getUserById(token, userId);
  if (!user) {
    return null;
  }

  const avatar = await getUserImage(token, userId);
  return makeSnapshot(user, avatar);
}

export async function syncMemberSnapshot(
  member: MemberRow,
  snapshot: MemberSyncSnapshot,
) {
  const nextCampus = snapshot.campus ?? member.campus ?? null;
  const nextClassNumber = snapshot.classNumber ?? member.class_number ?? null;
  const nextAvatarContentType = snapshot.avatarFetched
    ? snapshot.avatarContentType
    : member.avatar_content_type ?? null;
  const nextAvatarBase64 = snapshot.avatarFetched
    ? snapshot.avatarBase64
    : member.avatar_base64 ?? null;

  const changedFields: MemberSyncField[] = [];
  const changes: Partial<Record<MemberSyncField, string>> = {};

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
  if ((member.class_number ?? null) !== nextClassNumber) {
    changedFields.push("classNumber");
    changes.classNumber = `${member.class_number ?? "-"} → ${nextClassNumber ?? "-"}`;
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
    class_number: nextClassNumber,
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
      class_number: nextMember.class_number,
      avatar_content_type: nextMember.avatar_content_type,
      avatar_base64: nextMember.avatar_base64,
      updated_at: updatedAt,
    })
    .eq("id", member.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    member: nextMember,
    snapshot,
    updated: true,
    changedFields,
    changes,
  } satisfies MemberSyncResult;
}

export async function syncMemberById(
  memberId: string,
): Promise<MemberSyncResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data: member, error } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,class_number,avatar_content_type,avatar_base64,updated_at",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!member?.id) {
    return null;
  }

  const senderCredentials = getSenderCredentials(member.year);
  const senderLogin = await loginWithPassword(
    senderCredentials.loginId,
    senderCredentials.password,
  );
  const snapshot = await fetchMemberSnapshotByUserId(
    senderLogin.token,
    member.mm_user_id,
  );
  if (!snapshot) {
    return null;
  }

  return syncMemberSnapshot(member as MemberRow, snapshot);
}

export async function syncMembersBySelectableYears(): Promise<MemberSyncBatchResult> {
  const supabase = getSupabaseAdminClient();
  const years = getBackfillableSsafyYears();
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,class_number,avatar_content_type,avatar_base64,updated_at",
    )
    .in("year", years)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const groupedMembers = new Map<number, MemberRow[]>();
  (members ?? []).forEach((member) => {
    const year = Number(member.year);
    const list = groupedMembers.get(year) ?? [];
    list.push(member as MemberRow);
    groupedMembers.set(year, list);
  });

  const results: MemberSyncResult[] = [];
  const failures: Array<{ memberId: string; mmUserId: string; reason: string }> = [];

  for (const year of years.sort((a, b) => b - a)) {
    const yearMembers = groupedMembers.get(year) ?? [];
    if (yearMembers.length === 0) {
      continue;
    }

    let senderToken: string;
    try {
      const senderCredentials = getSenderCredentials(year);
      const senderLogin = await loginWithPassword(
        senderCredentials.loginId,
        senderCredentials.password,
      );
      senderToken = senderLogin.token;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "MM 로그인 실패";
      yearMembers.forEach((member) => {
        failures.push({
          memberId: member.id,
          mmUserId: member.mm_user_id,
          reason,
        });
      });
      continue;
    }

    for (const member of yearMembers) {
      try {
        const snapshot = await fetchMemberSnapshotByUserId(
          senderToken,
          member.mm_user_id,
        );
        if (!snapshot) {
          failures.push({
            memberId: member.id,
            mmUserId: member.mm_user_id,
            reason: "MM 사용자 조회 실패",
          });
          continue;
        }
        const result = await syncMemberSnapshot(member, snapshot);
        if (result.updated) {
          results.push(result);
        }
      } catch (error) {
        failures.push({
          memberId: member.id,
          mmUserId: member.mm_user_id,
          reason: error instanceof Error ? error.message : "동기화 실패",
        });
      }
    }
  }

  return {
    checked: (members ?? []).length,
    updated: results.length,
    skipped: Math.max((members ?? []).length - results.length - failures.length, 0),
    results,
    failures,
  };
}
