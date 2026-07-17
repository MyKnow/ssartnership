import type { MattermostLoginDisabledReason } from "@/lib/member-mattermost-auth";
import type { MattermostUser } from "@/lib/mattermost/client";

export type MattermostLifecycleStatus =
  | "active"
  | "graduated"
  | "departed"
  | "unresolved";

/**
 * Direct Mattermost lookups only trust an explicit non-zero delete_at value.
 * Missing records, transport failures and malformed responses are represented
 * by null upstream and must never disable a local member.
 */
export type MattermostLifecycleResult = {
  mmUserId: string;
  username: string;
  deleteAt: number;
  lifecycleStatus: MattermostLifecycleStatus;
  detailCode: "MM_USER_ACTIVE" | "MM_USER_DELETE_AT_SET";
  effectiveAt: string | null;
  requestId: null;
};

export type MattermostLifecycleResolution = {
  lifecycleStatus: MattermostLifecycleStatus;
  transitionReason: Extract<MattermostLoginDisabledReason, "generation_completed" | "member_departed"> | null;
  detailCode: string;
};

export function toMattermostLifecycleResult(
  user: Pick<MattermostUser, "id" | "username" | "deleteAt">,
): MattermostLifecycleResult {
  if (!Number.isFinite(user.deleteAt) || user.deleteAt < 0) {
    throw new Error("Mattermost lifecycle response is invalid.");
  }

  const deleted = user.deleteAt > 0;
  return {
    mmUserId: user.id,
    username: user.username,
    deleteAt: user.deleteAt,
    lifecycleStatus: deleted ? "unresolved" : "active",
    detailCode: deleted ? "MM_USER_DELETE_AT_SET" : "MM_USER_ACTIVE",
    effectiveAt: null,
    requestId: null,
  };
}

export function resolveMattermostLifecycle(input: {
  result: MattermostLifecycleResult | null;
  isStaff: boolean;
}): MattermostLifecycleResolution {
  const result = input.result;
  if (!result) {
    return {
      lifecycleStatus: "unresolved",
      transitionReason: null,
      detailCode: "MM_USER_RESULT_MISSING",
    };
  }

  if (!Number.isFinite(result.deleteAt) || result.deleteAt < 0) {
    return {
      lifecycleStatus: "unresolved",
      transitionReason: null,
      detailCode: "MM_USER_RESPONSE_INVALID",
    };
  }

  if (result.deleteAt > 0) {
    return {
      lifecycleStatus: input.isStaff ? "departed" : "graduated",
      transitionReason: input.isStaff ? "member_departed" : "generation_completed",
      detailCode: "MM_USER_DELETE_AT_SET",
    };
  }

  return {
    lifecycleStatus: "active",
    transitionReason: null,
    detailCode: "MM_USER_ACTIVE",
  };
}
