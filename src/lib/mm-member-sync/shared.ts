export type MemberSyncField =
  | "mmUsername"
  | "displayName"
  | "campus"
  | "track"
  | "avatar";

export type MemberSyncSnapshot = {
  mmUserId: string;
  mmUsername: string;
  displayName: string;
  campus: string | null;
  track: string | null;
  trackName: string | null;
  avatarFetched: boolean;
  avatarUrl: string | null;
  avatarContentType: string | null;
  avatarBase64: string | null;
};

export type NormalizedMemberSyncSubject = {
  id: string;
  generation: number | null;
  mattermostAccountId: string;
  mmUserId: string;
  mmUsername: string;
};

export type MemberSyncResult = {
  member: NormalizedMemberSyncSubject;
  snapshot: MemberSyncSnapshot;
  updated: boolean;
  changedFields: MemberSyncField[];
};

export type MemberSyncBatchResult = {
  checked: number;
  updated: number;
  skipped: number;
  results: MemberSyncResult[];
  failures: Array<{ memberId: string; mmUserId: string | null; reason: string }>;
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

export function wrapMmMemberSyncDbError(
  error: { message?: string | null } | null | undefined,
  message = "회원 동기화를 처리하지 못했습니다.",
) {
  return new MmMemberSyncError("db_error", error?.message?.trim() || message);
}
