import type { MattermostLoginDisabledReason } from "@/lib/member-mattermost-auth";
import type {
  MattermostLifecycleResult,
  MattermostLifecycleStatus,
} from "./lifecycle";

export type MemberSyncField =
  | "mmUsername"
  | "displayName"
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
  imageSkipped: boolean;
};

export type MemberMattermostUnavailableResult = {
  member: NormalizedMemberSyncSubject;
  lifecycleStatus: Extract<MattermostLifecycleStatus, "graduated" | "departed">;
  detailCode: string;
  providerRequestId: string | null;
  transitionReason: Extract<MattermostLoginDisabledReason, "generation_completed" | "member_departed">;
};

export type MemberSyncFailure = {
  memberId: string;
  mmUserId: string | null;
  reason: string;
  detailCode?: string | null;
  providerRequestId?: string | null;
};

export type MemberSyncAuditResult = {
  member: NormalizedMemberSyncSubject;
  status: "updated" | "unchanged" | "photo_skipped" | "graduated" | "departed" | "unresolved" | "failed";
  changedFields: MemberSyncField[];
  imageSkipped: boolean;
  lifecycleStatus: MattermostLifecycleStatus | null;
  detailCode: string | null;
  providerRequestId: string | null;
  transitionReason: MattermostLoginDisabledReason | null;
  reason: string | null;
  lifecycle: MattermostLifecycleResult | null;
};

export type MemberSyncBatchResult = {
  checked: number;
  updated: number;
  skipped: number;
  results: MemberSyncResult[];
  photoSkipped: MemberSyncResult[];
  mattermostUnavailable: MemberMattermostUnavailableResult[];
  failures: MemberSyncFailure[];
  auditResults: MemberSyncAuditResult[];
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
