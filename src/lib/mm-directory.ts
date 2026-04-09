import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import { SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";
import { getConfiguredSelectableSsafyYears } from "@/lib/ssafy-cycle-settings";
import {
  getChannelByName,
  getSenderCredentials,
  getStudentChannelConfig,
  getTeamByName,
  getUserById,
  listChannelMembers,
  loginWithPassword,
  type MMUser,
} from "@/lib/mattermost";
import { normalizeMmUsername } from "@/lib/validation";

export type MmUserDirectoryRow = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string;
  campus?: string | null;
  is_staff: boolean;
  source_years: number[];
  synced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MmUserDirectorySnapshot = {
  mmUserId: string;
  mmUsername: string;
  displayName: string;
  campus: string | null;
  isStaff: boolean;
  sourceYears: number[];
};

export type MmUserDirectorySyncResult = {
  checked: number;
  uniqueUsers: number;
  upserted: number;
  deleted: number;
  failures: Array<{
    sourceYear: number;
    userId?: string | null;
    reason: string;
  }>;
};

function uniqueSortedYears(years: Iterable<number>) {
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

function buildSnapshotFromUser(user: MMUser, sourceYear: number): MmUserDirectorySnapshot {
  const profile = parseSsafyProfileFromUser(user);
  const isStaff = Boolean(profile.isStaff);
  const displayName = profile.displayName ?? user.nickname ?? user.username;
  return {
    mmUserId: user.id,
    mmUsername: user.username,
    displayName,
    campus: profile.campus ?? null,
    isStaff,
    sourceYears: uniqueSortedYears([
      sourceYear,
      ...(isStaff ? [SSAFY_STAFF_YEAR] : []),
    ]),
  };
}

async function listAllChannelMemberIds(token: string, channelId: string) {
  const memberIds: string[] = [];
  let page = 0;
  const perPage = 200;

  for (;;) {
    const members = await listChannelMembers(token, channelId, page, perPage);
    if (members.length === 0) {
      break;
    }
    memberIds.push(
      ...members
        .map((member) => member.user_id ?? member.userId ?? null)
        .filter((value): value is string => Boolean(value)),
    );
    if (members.length < perPage) {
      break;
    }
    page += 1;
  }

  return memberIds;
}

async function getAllSelectableUserSnapshots() {
  const configuredSelectableYears = await getConfiguredSelectableSsafyYears();
  const years = Array.from(
    new Set([...configuredSelectableYears, 15, 14]),
  ).sort((a, b) => b - a);
  const snapshots = new Map<string, MmUserDirectorySnapshot>();
  const failures: MmUserDirectorySyncResult["failures"] = [];
  let checked = 0;

  for (const sourceYear of years) {
    try {
      const credentials = getSenderCredentials(sourceYear);
      const senderLogin = await loginWithPassword(
        credentials.loginId,
        credentials.password,
      );
      const channelConfig = getStudentChannelConfig(sourceYear);
      const team = await getTeamByName(senderLogin.token, channelConfig.teamName);
      const channel = await getChannelByName(
        senderLogin.token,
        team.id,
        channelConfig.channelName,
      );
      const memberIds = await listAllChannelMemberIds(senderLogin.token, channel.id);
      checked += memberIds.length;

      const users = await Promise.all(
        memberIds.map(async (userId) => {
          try {
            return await getUserById(senderLogin.token, userId);
          } catch (error) {
            failures.push({
              sourceYear,
              userId,
              reason: error instanceof Error ? error.message : "MM 사용자 조회 실패",
            });
            return null;
          }
        }),
      );

      for (const user of users) {
        if (!user || user.is_bot) {
          continue;
        }

        const snapshot = buildSnapshotFromUser(user, sourceYear);
        const existing = snapshots.get(snapshot.mmUserId);
        if (!existing) {
          snapshots.set(snapshot.mmUserId, snapshot);
          continue;
        }

        existing.mmUsername = snapshot.mmUsername;
        existing.displayName = snapshot.displayName;
        existing.campus = snapshot.campus ?? existing.campus ?? null;
        existing.isStaff = existing.isStaff || snapshot.isStaff;
        existing.sourceYears = uniqueSortedYears([
          ...existing.sourceYears,
          ...snapshot.sourceYears,
        ]);
      }
    } catch (error) {
      failures.push({
        sourceYear,
        reason: error instanceof Error ? error.message : "MM 디렉토리 동기화 실패",
      });
    }
  }

  return {
    checked,
    snapshots,
    failures,
  };
}

export async function findMmUserDirectoryEntryByUsername(username: string) {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizeMmUsername(username);
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("mm_user_directory")
    .select(
      "id,mm_user_id,mm_username,display_name,campus,is_staff,source_years,synced_at,created_at,updated_at",
    )
    .eq("mm_username", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MmUserDirectoryRow | null) ?? null;
}

export async function findMmUserDirectoryEntryByUsernameAndYear(
  username: string,
  year: number,
) {
  return findMmUserDirectoryStudentEntryByUsernameAndYear(username, year);
}

export async function findMmUserDirectoryStudentEntryByUsernameAndYear(
  username: string,
  year: number,
) {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizeMmUsername(username);
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("mm_user_directory")
    .select(
      "id,mm_user_id,mm_username,display_name,campus,is_staff,source_years,synced_at,created_at,updated_at",
    )
    .eq("mm_username", normalized)
    .contains("source_years", [year])
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = (data as MmUserDirectoryRow | null) ?? null;
  if (!row || row.is_staff) {
    return null;
  }
  return row;
}

export async function findMmUserDirectoryStaffEntryByUsername(
  username: string,
) {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizeMmUsername(username);
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("mm_user_directory")
    .select(
      "id,mm_user_id,mm_username,display_name,campus,is_staff,source_years,synced_at,created_at,updated_at",
    )
    .eq("mm_username", normalized)
    .eq("is_staff", true)
    .or("source_years.cs.{14},source_years.cs.{15}")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MmUserDirectoryRow | null) ?? null;
}

export async function upsertMmUserDirectorySnapshot(snapshot: MmUserDirectorySnapshot) {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("mm_user_directory")
    .select("mm_user_id,source_years,campus,is_staff")
    .eq("mm_user_id", snapshot.mmUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const sourceYears = uniqueSortedYears([
    ...(existing?.source_years ?? []),
    ...snapshot.sourceYears,
    ...(snapshot.isStaff ? [SSAFY_STAFF_YEAR] : []),
  ]);
  const now = new Date().toISOString();
  const nextCampus = snapshot.campus ?? existing?.campus ?? null;
  const nextIsStaff = Boolean(existing?.is_staff || snapshot.isStaff);

  const { error } = await supabase.from("mm_user_directory").upsert(
    {
      mm_user_id: snapshot.mmUserId,
      mm_username: snapshot.mmUsername,
      display_name: snapshot.displayName,
      campus: nextCampus ?? null,
      is_staff: nextIsStaff,
      source_years: sourceYears,
      synced_at: now,
      updated_at: now,
    },
    {
      onConflict: "mm_user_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...snapshot,
    sourceYears,
  };
}

export async function syncMmUserDirectoryBySelectableYears(): Promise<MmUserDirectorySyncResult> {
  const { checked, snapshots, failures } = await getAllSelectableUserSnapshots();
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("mm_user_directory")
    .select("mm_user_id,campus,is_staff,source_years");
  if (existingRowsError) {
    throw new Error(existingRowsError.message);
  }

  const existingMap = new Map(
    (existingRows ?? []).map((row) => [row.mm_user_id, row]),
  );
  const rows = Array.from(snapshots.values()).map((snapshot) => {
    const existing = existingMap.get(snapshot.mmUserId);
    const sourceYears = uniqueSortedYears([
      ...(existing?.source_years ?? []),
      ...snapshot.sourceYears,
      ...(snapshot.isStaff ? [SSAFY_STAFF_YEAR] : []),
    ]);
    return {
      mm_user_id: snapshot.mmUserId,
      mm_username: snapshot.mmUsername,
      display_name: snapshot.displayName,
      campus: snapshot.campus ?? existing?.campus ?? null,
      is_staff: Boolean(existing?.is_staff || snapshot.isStaff),
      source_years: sourceYears,
      synced_at: now,
      updated_at: now,
    };
  });

  if (rows.length === 0) {
    throw new Error("MM 유저 디렉토리를 동기화할 수 없습니다.");
  }

  const { error: upsertError } = await supabase
    .from("mm_user_directory")
    .upsert(rows, {
      onConflict: "mm_user_id",
    });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  let staleIds: string[] = [];
  if (failures.length === 0) {
    const { data: existing, error: existingError } = await supabase
      .from("mm_user_directory")
      .select("mm_user_id");
    if (existingError) {
      throw new Error(existingError.message);
    }

    const seenIds = new Set(rows.map((row) => row.mm_user_id));
    staleIds = (existing ?? [])
      .map((row) => row.mm_user_id)
      .filter((mmUserId) => !seenIds.has(mmUserId));

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("mm_user_directory")
        .delete()
        .in("mm_user_id", staleIds);
      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }
  }

  return {
    checked,
    uniqueUsers: rows.length,
    upserted: rows.length,
    deleted: staleIds.length,
    failures,
  };
}
