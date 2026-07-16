import type { MattermostLoginDisabledReason } from "@/lib/member-mattermost-auth";

export type MattermostLifecycleStatus =
  | "active"
  | "graduated"
  | "departed"
  | "unresolved";

export type MattermostLifecycleMemberType = "student" | "staff" | null;

export type MattermostLifecycleResult = {
  mmUserId: string;
  username: string | null;
  memberType: MattermostLifecycleMemberType;
  lifecycleStatus: MattermostLifecycleStatus;
  detailCode: string;
  effectiveAt: string | null;
  requestId: string | null;
};

export type ParsedMattermostLifecycleBatch = {
  requestId: string | null;
  results: Map<string, MattermostLifecycleResult>;
};

export type MattermostLifecycleResolution = {
  lifecycleStatus: MattermostLifecycleStatus;
  transitionReason: Extract<MattermostLoginDisabledReason, "generation_completed" | "member_departed"> | null;
  detailCode: string;
};

type UnknownRecord = Record<string, unknown>;

const MATTERMOST_ID_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;
const DETAIL_CODE_PATTERN = /^[A-Z0-9_]{1,96}$/;
const LIFECYCLE_STATUSES = new Set<MattermostLifecycleStatus>([
  "active",
  "graduated",
  "departed",
  "unresolved",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readRequestId(record: UnknownRecord) {
  const value = readString(record, ["request_id", "requestId"]);
  return value && REQUEST_ID_PATTERN.test(value) ? value : null;
}

function readDetailCode(record: UnknownRecord) {
  const value = readString(record, ["detail_code", "detailCode", "error_code", "errorCode"]);
  return value && DETAIL_CODE_PATTERN.test(value) ? value : "LIFECYCLE_RESULT_INVALID";
}

function readLifecycleStatus(value: unknown): MattermostLifecycleStatus | null {
  return typeof value === "string" && LIFECYCLE_STATUSES.has(value as MattermostLifecycleStatus)
    ? value as MattermostLifecycleStatus
    : null;
}

function readMemberType(value: unknown): MattermostLifecycleMemberType {
  if (value === "student" || value === "staff") {
    return value;
  }
  return null;
}

function readResult(
  value: unknown,
  batchRequestId: string | null,
): MattermostLifecycleResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const mmUserId = readString(value, ["mm_user_id", "mmUserId", "mattermost_user_id"]);
  const lifecycleStatus = readLifecycleStatus(
    value.lifecycle_status ?? value.lifecycleStatus,
  );
  if (!mmUserId || !MATTERMOST_ID_PATTERN.test(mmUserId) || !lifecycleStatus) {
    return null;
  }

  return {
    mmUserId,
    username: readString(value, ["username", "mm_username", "mattermost_username"]),
    memberType: readMemberType(value.member_type ?? value.memberType),
    lifecycleStatus,
    detailCode: readDetailCode(value),
    effectiveAt: readString(value, ["effective_at", "effectiveAt"]),
    requestId: readRequestId(value) ?? batchRequestId,
  };
}

export function parseMattermostLifecycleBatch(
  payload: unknown,
  requestedMattermostUserIds: readonly string[],
): ParsedMattermostLifecycleBatch {
  if (!isRecord(payload)) {
    throw new Error("SSAFY Verify lifecycle batch 응답이 올바르지 않습니다.");
  }
  const data = isRecord(payload.data) ? payload.data : null;
  const rawResults = data?.results;
  if (!data || !Array.isArray(rawResults)) {
    throw new Error("SSAFY Verify lifecycle batch 결과가 없습니다.");
  }

  const requestedIds = new Set(requestedMattermostUserIds);
  const batchRequestId = readRequestId(payload);
  const results = new Map<string, MattermostLifecycleResult>();
  for (const rawResult of rawResults) {
    const result = readResult(rawResult, batchRequestId);
    if (!result || !requestedIds.has(result.mmUserId)) {
      throw new Error("SSAFY Verify lifecycle batch 회원 결과가 올바르지 않습니다.");
    }
    results.set(result.mmUserId, result);
  }

  return { requestId: batchRequestId, results };
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
      detailCode: "LIFECYCLE_RESULT_MISSING",
    };
  }

  const expectedStatus = input.isStaff ? "departed" : "graduated";
  const expectedMemberType = input.isStaff ? "staff" : "student";
  const memberTypeMismatch = result.memberType !== null
    && result.memberType !== expectedMemberType;

  if (memberTypeMismatch) {
    return {
      lifecycleStatus: "unresolved",
      transitionReason: null,
      detailCode: "LIFECYCLE_MEMBER_TYPE_MISMATCH",
    };
  }

  if (result.detailCode === "MATTERMOST_ID_NOT_MAPPED") {
    return {
      lifecycleStatus: expectedStatus,
      transitionReason: input.isStaff ? "member_departed" : "generation_completed",
      detailCode: result.detailCode,
    };
  }

  if (result.lifecycleStatus === expectedStatus && result.detailCode === "USER_INACTIVE") {
    return {
      lifecycleStatus: expectedStatus,
      transitionReason: input.isStaff ? "member_departed" : "generation_completed",
      detailCode: result.detailCode,
    };
  }

  if (result.lifecycleStatus === "active") {
    return {
      lifecycleStatus: "active",
      transitionReason: null,
      detailCode: result.detailCode,
    };
  }

  return {
    lifecycleStatus: "unresolved",
    transitionReason: null,
    detailCode: result.detailCode,
  };
}
