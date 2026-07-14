import {
  isValidEmail,
  normalizeMmUsername,
  validateMmUsername,
} from "@/lib/validation";
import { createHmacDigest } from "@/lib/hmac.js";
import {
  DIRECT_MEMBER_LOGIN_ID_PREFIX,
  normalizeDirectMemberLoginId,
} from "@/lib/member-direct-create";

export type MemberLoginIdentifier =
  | { kind: "email"; value: string }
  | { kind: "manual_login_id"; value: string }
  | { kind: "mattermost_username"; value: string };

export type MattermostProfileSnapshot = {
  displayName: string;
  campus: string | null;
  mmUsername: string;
};

export type MemberIdentifierReservation = {
  identifierKind: "email" | "mm_user_id" | "mm_username" | "ssafy_sub";
  identifierHash: string;
};

export type MemberIdentifierReservationInput = {
  emailNormalized?: string | null;
  mmUserId?: string | null;
  mmUsername?: string | null;
  ssafySub?: string | null;
};

type MemberProfileState = {
  displayName: string | null;
  campus: string | null;
  mmUsername: string | null;
};

export function normalizeMemberEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return isValidEmail(normalized) ? normalized : null;
}

export function classifyMemberLoginIdentifier(value: unknown): MemberLoginIdentifier | null {
  if (typeof value !== "string") {
    return null;
  }

  const rawValue = value.trim();
  const email = normalizeMemberEmail(rawValue);
  if (email) {
    return { kind: "email", value: email };
  }

  if (rawValue.toLowerCase().startsWith(DIRECT_MEMBER_LOGIN_ID_PREFIX)) {
    const manualLoginId = normalizeDirectMemberLoginId(rawValue);
    return manualLoginId.value
      ? { kind: "manual_login_id", value: manualLoginId.value }
      : null;
  }

  const username = normalizeMmUsername(rawValue.replace(/^@/, ""));
  return validateMmUsername(username) ? null : { kind: "mattermost_username", value: username };
}

export function normalizeMemberGeneration(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(normalized)) {
    return null;
  }
  const generation = Number(normalized);
  return Number.isInteger(generation) && generation >= 0 && generation <= 99
    ? generation
    : null;
}

export function isActiveMember(input: { id: string | null | undefined; deletedAt: string | null | undefined }) {
  return Boolean(input.id?.trim()) && input.deletedAt === null;
}

export function buildMattermostProfileSyncPatch(
  member: MemberProfileState,
  snapshot: MattermostProfileSnapshot,
) {
  const memberPatch: Record<string, string | null> = {};
  const mattermostPatch: Record<string, string> = {};
  const changedFields: Array<"displayName" | "campus" | "mmUsername"> = [];

  if (member.displayName !== snapshot.displayName) {
    memberPatch.display_name = snapshot.displayName;
    changedFields.push("displayName");
  }
  if (member.campus !== snapshot.campus) {
    memberPatch.campus = snapshot.campus;
    changedFields.push("campus");
  }
  if (member.mmUsername !== snapshot.mmUsername) {
    mattermostPatch.mm_username = snapshot.mmUsername;
    changedFields.push("mmUsername");
  }

  return {
    member: memberPatch,
    mattermost: mattermostPatch,
    changedFields,
  };
}

export function buildMemberIdentifierReservations(
  input: MemberIdentifierReservationInput,
  secret: string,
) {
  const normalizedValues: Array<{
    identifierKind: MemberIdentifierReservation["identifierKind"];
    value: string | null;
  }> = [
    { identifierKind: "email", value: normalizeMemberEmail(input.emailNormalized) },
    { identifierKind: "mm_user_id", value: input.mmUserId?.trim() || null },
    { identifierKind: "mm_username", value: input.mmUsername ? normalizeMmUsername(input.mmUsername) : null },
    { identifierKind: "ssafy_sub", value: input.ssafySub?.trim() || null },
  ];

  return normalizedValues
    .filter((item): item is { identifierKind: MemberIdentifierReservation["identifierKind"]; value: string } => Boolean(item.value))
    .map((item) => ({
      identifierKind: item.identifierKind,
      identifierHash: createHmacDigest(`${item.identifierKind}:${item.value}`, secret, "hex"),
    }));
}
