import { parseSsafyProfileFromUser, type ParsedProfile } from "@/lib/mm-profile";
import { normalizeManualMemberImportCampus } from "@/lib/member-manual-import/options";

export const MATTERMOST_SIGNUP_MODES = ["direct", "approval"] as const;
export type MattermostSignupMode = (typeof MATTERMOST_SIGNUP_MODES)[number];

export const MATTERMOST_SIGNUP_PARSE_REASONS = [
  "campus_ambiguous",
  "student_signal_without_affiliation",
  "display_only",
  "display_name_not_person_like",
  "profile_unavailable",
] as const;
export type MattermostSignupParseReason =
  (typeof MATTERMOST_SIGNUP_PARSE_REASONS)[number];

export type MattermostSignupProfileInput = {
  id: string;
  username: string;
  nickname: string;
  firstName: string;
  lastName: string;
};

export type MattermostSignupProfileClassification = {
  mode: MattermostSignupMode;
  profile: ParsedProfile;
  parseReason: MattermostSignupParseReason | null;
};

export function classifyMattermostSignupProfile(
  user: MattermostSignupProfileInput,
): MattermostSignupProfileClassification {
  const profile = parseSsafyProfileFromUser({
    nickname: user.nickname,
    first_name: user.firstName,
    last_name: user.lastName,
    username: user.username,
  });
  const mode = profile.parseModeCandidateMatch === true ? "direct" : "approval";
  const parseReason = normalizeMattermostSignupParseReason(
    profile.parsedExclusionReason,
  );

  return {
    mode,
    profile: {
      ...profile,
      ...(mode === "approval" && !profile.parsedExclusionReason
        ? { parsedExclusionReason: "profile_unavailable" }
        : {}),
    },
    parseReason: mode === "approval" ? parseReason ?? "profile_unavailable" : null,
  };
}

export function normalizeMattermostSignupParseReason(
  value: unknown,
): MattermostSignupParseReason | null {
  return typeof value === "string"
    && (MATTERMOST_SIGNUP_PARSE_REASONS as readonly string[]).includes(value)
    ? value as MattermostSignupParseReason
    : null;
}

export type MattermostSignupApprovalDecision = {
  displayName: string;
  generation: number;
  campus: string | null;
};

export type MattermostSignupApprovalDecisionResult =
  | { ok: true; value: MattermostSignupApprovalDecision }
  | {
      ok: false;
      fieldErrors: Partial<Record<"displayName" | "generation" | "campus", string>>;
    };

export function parseMattermostSignupApprovalDecision(
  input: Record<string, unknown>,
): MattermostSignupApprovalDecisionResult {
  const displayName = typeof input.displayName === "string"
    ? input.displayName.trim()
    : "";
  const generationRaw = typeof input.generation === "string" || typeof input.generation === "number"
    ? String(input.generation).trim()
    : "";
  const campusRaw = typeof input.campus === "string" ? input.campus.trim() : "";
  const fieldErrors: Partial<Record<"displayName" | "generation" | "campus", string>> = {};

  if (!displayName) {
    fieldErrors.displayName = "이름을 입력해 주세요.";
  } else if (displayName.length > 128) {
    fieldErrors.displayName = "이름은 128자 이하로 입력해 주세요.";
  }

  const generation = /^\d{1,2}$/u.test(generationRaw)
    ? Number(generationRaw)
    : null;
  if (generation === null || generation < 0 || generation > 99) {
    fieldErrors.generation = "기수를 0~99 사이 숫자로 입력해 주세요.";
  }

  const normalizedCampus = normalizeManualMemberImportCampus(campusRaw);
  if (generation !== null && generation > 0 && !normalizedCampus) {
    fieldErrors.campus = "캠퍼스를 선택해 주세요.";
  }

  if (Object.keys(fieldErrors).length > 0 || generation === null) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      displayName,
      generation,
      campus: generation === 0 ? null : normalizedCampus,
    },
  };
}

export type MattermostSignupApprovalRequestSummary = {
  id: string;
  mmUserId: string;
  mmUsername: string;
  mattermostDisplayName: string;
  senderGeneration: number;
  requestedGeneration: number;
  parseExclusionReason: MattermostSignupParseReason | null;
  status: "pending" | "approved" | "rejected";
  marketingPolicyChecked: boolean;
  consentAgreedAt: string;
  createdAt: string;
  updatedAt: string;
};

type MattermostSignupApprovalRequestRow = Record<string, unknown>;

export function toSafeMattermostSignupApprovalRequest(
  row: MattermostSignupApprovalRequestRow,
): MattermostSignupApprovalRequestSummary {
  const status = row.status === "approved" || row.status === "rejected"
    ? row.status
    : "pending";
  const parseReason = normalizeMattermostSignupParseReason(row.parse_exclusion_reason);
  return {
    id: String(row.id ?? ""),
    mmUserId: String(row.mm_user_id ?? ""),
    mmUsername: String(row.mm_username ?? ""),
    mattermostDisplayName: String(row.mattermost_display_name ?? ""),
    senderGeneration: Number(row.sender_generation ?? 0),
    requestedGeneration: Number(row.requested_generation ?? 0),
    parseExclusionReason: parseReason,
    status,
    marketingPolicyChecked: row.marketing_policy_checked === true,
    consentAgreedAt: String(row.consent_agreed_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
