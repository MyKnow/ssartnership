import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import { SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";
import type { MMUser } from "@/lib/mattermost";

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

export type MmDirectoryErrorCode = "db_error" | "invalid_state";

export class MmDirectoryError extends Error {
  code: MmDirectoryErrorCode;

  constructor(code: MmDirectoryErrorCode, message: string) {
    super(message);
    this.name = "MmDirectoryError";
    this.code = code;
  }
}

export function uniqueSortedYears(years: Iterable<number>) {
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

export function wrapMmDirectoryDbError(
  error: { message?: string | null } | null | undefined,
  message = "MM 유저 디렉토리를 처리하지 못했습니다.",
) {
  return new MmDirectoryError("db_error", error?.message?.trim() || message);
}

export function buildSnapshotFromUser(user: MMUser, sourceYear: number): MmUserDirectorySnapshot {
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

export function mergeDirectorySnapshot(
  existing: MmUserDirectorySnapshot | undefined,
  next: MmUserDirectorySnapshot,
) {
  if (!existing) {
    return { ...next };
  }

  return {
    ...existing,
    mmUsername: next.mmUsername,
    displayName: next.displayName,
    campus: next.campus ?? existing.campus ?? null,
    isStaff: existing.isStaff || next.isStaff,
    sourceYears: uniqueSortedYears([
      ...existing.sourceYears,
      ...next.sourceYears,
    ]),
  };
}
