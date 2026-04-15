import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import {
  getConfiguredBackfillableSsafyYears,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
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
  staff_source_year?: number | null;
  campus?: string | null;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
  updated_at?: string | null;
};

type MemberSyncField = "mmUsername" | "displayName" | "campus" | "avatar";

type SenderSession = {
  year: number;
  token: string;
};

export type MemberSyncSnapshot = {
  mmUserId: string;
  mmUsername: string;
  displayName: string;
  campus: string | null;
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

export type MmMemberSyncErrorCode = "db_error" | "lookup_failed" | "invalid_state";

export class MmMemberSyncError extends Error {
  code: MmMemberSyncErrorCode;

  constructor(code: MmMemberSyncErrorCode, message: string) {
    super(message);
    this.name = "MmMemberSyncError";
    this.code = code;
  }
}

function makeSnapshot(user: MMUser, avatar: { contentType: string; base64: string } | null): MemberSyncSnapshot {
  const profile = parseSsafyProfileFromUser(user);
  const displayName = profile.displayName ?? user.nickname ?? user.username;

  return {
    mmUserId: user.id,
    mmUsername: user.username,
    displayName,
    campus: profile.campus ?? null,
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
  if (result.changes.avatar) {
    summaryParts.push("프로필 사진 업데이트");
  }

  return summaryParts.join(" / ");
}

function getMemberSyncCandidateYears(year: number) {
  if (year === 0) {
    return [15, 14];
  }
  return [year];
}

function wrapMmMemberSyncDbError(
  error: { message?: string | null } | null | undefined,
  message = "회원 동기화를 처리하지 못했습니다.",
) {
  return new MmMemberSyncError("db_error", error?.message?.trim() || message);
}

async function getSenderSessionForYear(
  year: number,
  cache: Map<number, Promise<SenderSession>>,
) {
  const cached = cache.get(year);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const credentials = getSenderCredentials(year);
    const senderLogin = await loginWithPassword(
      credentials.loginId,
      credentials.password,
    );
    return {
      year,
      token: senderLogin.token,
    } satisfies SenderSession;
  })();

  cache.set(year, promise);

  try {
    return await promise;
  } catch (error) {
    cache.delete(year);
    throw error;
  }
}

async function resolveMemberSnapshotForYears(
  member: MemberRow,
  candidateYears: number[],
  cache: Map<number, Promise<SenderSession>>,
) {
  let lastError: Error | null = null;

  for (const senderYear of candidateYears) {
    try {
      const sender = await getSenderSessionForYear(senderYear, cache);
      const snapshot = await fetchMemberSnapshotByUserId(
        sender.token,
        member.mm_user_id,
      );
      if (!snapshot) {
        continue;
      }
      return {
        senderYear,
        senderToken: sender.token,
        snapshot,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("MM 사용자 조회 실패");
    }
  }

  if (lastError) {
    throw new MmMemberSyncError(
      "lookup_failed",
      lastError.message || "MM 사용자 조회 실패",
    );
  }

  return null;
}

type MemberSyncYearBatchResult = {
  results: MemberSyncResult[];
  failures: Array<{ memberId: string; mmUserId: string; reason: string }>;
};

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

export async function syncMemberById(
  memberId: string,
): Promise<MemberSyncResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data: member, error } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member?.id) {
    return null;
  }

  const senderSessionCache = new Map<number, Promise<SenderSession>>();
  const resolved = await resolveMemberSnapshotForYears(
    member as MemberRow,
    getMemberSyncCandidateYears(member.year),
    senderSessionCache,
  );
  if (!resolved) {
    return null;
  }

  return syncMemberSnapshot(member as MemberRow, resolved.snapshot);
}

export async function syncMembersBySelectableYears(): Promise<MemberSyncBatchResult> {
  const supabase = getSupabaseAdminClient();
  const cycleSettings = await getSsafyCycleSettings();
  const years = getConfiguredBackfillableSsafyYears(cycleSettings);
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
    )
    .in("year", years)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }

  const results: MemberSyncResult[] = [];
  const failures: Array<{ memberId: string; mmUserId: string; reason: string }> = [];
  const groupedMembers = new Map<number, MemberRow[]>();
  (members ?? []).forEach((member) => {
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
    list.push(member as MemberRow);
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
    checked: members?.length ?? 0,
    updated: results.length,
    skipped: (members?.length ?? 0) - results.length - failures.length,
    results,
    failures,
  };
}
