import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import type { MMUser } from "@/lib/mattermost";

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

export type MemberSyncField = "mmUsername" | "displayName" | "campus" | "avatar";

export type SenderSession = {
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

export function makeSnapshot(
  user: MMUser,
  avatar: { contentType: string; base64: string } | null,
): MemberSyncSnapshot {
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

export function wrapMmMemberSyncDbError(
  error: { message?: string | null } | null | undefined,
  message = "회원 동기화를 처리하지 못했습니다.",
) {
  return new MmMemberSyncError("db_error", error?.message?.trim() || message);
}

export function getMemberSyncCandidateYears(year: number) {
  if (year === 0) {
    return [15, 14];
  }
  return [year];
}
