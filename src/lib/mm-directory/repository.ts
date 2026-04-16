import { SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeMmUsername } from "@/lib/validation";
import { getAllSelectableUserSnapshots } from "./collector";
import {
  MmDirectoryError,
  type MmUserDirectoryRow,
  type MmUserDirectorySnapshot,
  type MmUserDirectorySyncResult,
  uniqueSortedYears,
  wrapMmDirectoryDbError,
} from "./shared";

const DIRECTORY_SELECT =
  "id,mm_user_id,mm_username,display_name,campus,is_staff,source_years,synced_at,created_at,updated_at";

export async function findMmUserDirectoryEntryByUsername(username: string) {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizeMmUsername(username);
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("mm_user_directory")
    .select(DIRECTORY_SELECT)
    .eq("mm_username", normalized)
    .maybeSingle();

  if (error) {
    throw wrapMmDirectoryDbError(
      error,
      "MM 유저 디렉토리를 불러오지 못했습니다.",
    );
  }

  return (data as MmUserDirectoryRow | null) ?? null;
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
    .select(DIRECTORY_SELECT)
    .eq("mm_username", normalized)
    .contains("source_years", [year])
    .maybeSingle();

  if (error) {
    throw wrapMmDirectoryDbError(
      error,
      "MM 유저 디렉토리를 불러오지 못했습니다.",
    );
  }

  const row = (data as MmUserDirectoryRow | null) ?? null;
  if (!row || row.is_staff) {
    return null;
  }
  return row;
}

export async function findMmUserDirectoryEntryByUsernameAndYear(
  username: string,
  year: number,
) {
  return findMmUserDirectoryStudentEntryByUsernameAndYear(username, year);
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
    .select(DIRECTORY_SELECT)
    .eq("mm_username", normalized)
    .eq("is_staff", true)
    .or("source_years.cs.{14},source_years.cs.{15}")
    .maybeSingle();

  if (error) {
    throw wrapMmDirectoryDbError(
      error,
      "MM 유저 디렉토리를 불러오지 못했습니다.",
    );
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
    throw wrapMmDirectoryDbError(
      existingError,
      "MM 유저 디렉토리를 불러오지 못했습니다.",
    );
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
    throw wrapMmDirectoryDbError(
      error,
      "MM 유저 디렉토리를 저장하지 못했습니다.",
    );
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
    throw wrapMmDirectoryDbError(
      existingRowsError,
      "MM 유저 디렉토리를 불러오지 못했습니다.",
    );
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
    throw new MmDirectoryError(
      "invalid_state",
      "MM 유저 디렉토리를 동기화할 수 없습니다.",
    );
  }

  const { error: upsertError } = await supabase
    .from("mm_user_directory")
    .upsert(rows, {
      onConflict: "mm_user_id",
    });

  if (upsertError) {
    throw wrapMmDirectoryDbError(
      upsertError,
      "MM 유저 디렉토리를 저장하지 못했습니다.",
    );
  }

  let staleIds: string[] = [];
  if (failures.length === 0) {
    const { data: existing, error: existingError } = await supabase
      .from("mm_user_directory")
      .select("mm_user_id");
    if (existingError) {
      throw wrapMmDirectoryDbError(
        existingError,
        "MM 유저 디렉토리를 불러오지 못했습니다.",
      );
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
        throw wrapMmDirectoryDbError(
          deleteError,
          "MM 유저 디렉토리를 정리하지 못했습니다.",
        );
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
