import { SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";
import { SSAFY_VERIFY_ISSUER } from "@/lib/ssafy-verify/config";
import type { MemberSyncSnapshot } from "@/lib/mm-member-sync/shared";
import type { MmUserDirectorySnapshot } from "@/lib/mm-directory/shared";

export type SsafyVerifyMattermostUser = {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
};

export type SsafyVerifyMemberProfile = {
  sub: string | null;
  mattermostUserId: string;
  mattermostUsername: string;
  displayName: string;
  campus: string | null;
  cohort: number | null;
  track: string | null;
  trackName: string | null;
  isStaff: boolean;
  sourceYears: number[];
  profileImage: {
    url: string | null;
    contentType: string | null;
    base64: string | null;
  } | null;
};

type UnknownRecord = Record<string, unknown>;

const MATTERMOST_ID_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const CONTENT_TYPE_PATTERN = /^image\/[A-Za-z0-9.+-]{1,40}$/;
const TRACK_SLUG_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const TRACK_NAME_MAX_LENGTH = 80;

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

function readRecord(record: UnknownRecord, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }
  return {};
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function readNumber(record: UnknownRecord, keys: readonly string[]) {
  for (const key of keys) {
    const parsed = parseNumber(record[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function readBoolean(record: UnknownRecord, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return null;
}

function uniqueSortedYears(values: Iterable<number | null | undefined>) {
  return Array.from(
    new Set(
      Array.from(values).filter(
        (value): value is number =>
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 99,
      ),
    ),
  ).sort((a, b) => a - b);
}

function readSourceYears(record: UnknownRecord) {
  const raw = record.source_years ?? record.sourceYears;
  if (!Array.isArray(raw)) {
    return [];
  }
  return uniqueSortedYears(raw.map(parseNumber));
}

function normalizeMattermostId(value: string | null) {
  if (!value || !MATTERMOST_ID_PATTERN.test(value)) {
    return null;
  }
  return value;
}

function normalizeContentType(value: string | null) {
  if (!value || !CONTENT_TYPE_PATTERN.test(value)) {
    return null;
  }
  return value;
}

function normalizeTrackSlug(value: string | null) {
  if (!value || !TRACK_SLUG_PATTERN.test(value)) {
    return null;
  }
  return value;
}

function normalizeTrackName(value: string | null) {
  if (!value || value.length > TRACK_NAME_MAX_LENGTH) {
    return null;
  }
  return value;
}

function normalizeImageUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value, SSAFY_VERIFY_ISSUER);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function readProfileImage(record: UnknownRecord) {
  const image = readRecord(record, ["profile_image", "profileImage", "picture"]);
  const url = normalizeImageUrl(
    readString(record, ["picture", "profile_image_url", "profileImageUrl", "avatar_url"]) ??
      readString(image, ["url", "src", "href"]),
  );
  const contentType = normalizeContentType(
    readString(record, ["profile_image_content_type", "avatar_content_type"]) ??
      readString(image, ["content_type", "contentType", "mime_type"]),
  );
  const base64 =
    readString(record, ["profile_image_base64", "avatar_base64"]) ??
    readString(image, ["base64", "data"]);

  if (!url && !contentType && !base64) {
    return null;
  }

  return {
    url,
    contentType,
    base64,
  };
}

export function normalizeSsafyVerifyMemberProfile(
  input: unknown,
): SsafyVerifyMemberProfile | null {
  if (!isRecord(input)) {
    return null;
  }

  const mattermost = readRecord(input, [
    "mattermost",
    "mattermost_user",
    "mattermostUser",
  ]);
  const mattermostUserId = normalizeMattermostId(
    readString(input, [
      "mattermost_user_id",
      "mattermostUserId",
      "ssafy_mattermost_user_id",
    ]) ?? readString(mattermost, ["user_id", "userId", "id"]),
  );
  const mattermostUsername = normalizeMattermostId(
    readString(input, [
      "mattermost_username",
      "mattermostUsername",
      "username",
    ]) ?? readString(mattermost, ["username"]),
  );

  if (!mattermostUserId || !mattermostUsername) {
    return null;
  }

  const cohort = readNumber(input, ["ssafy_cohort", "cohort", "year"]);
  const role = readString(input, ["ssafy_role", "role", "member_role"]);
  const explicitStaff = readBoolean(input, ["ssafy_is_staff", "is_staff", "isStaff"]);
  const roleIndicatesStaff =
    role === "staff" || role === "admin" || role === "operator";
  const isStaff =
    explicitStaff === true ||
    roleIndicatesStaff ||
    cohort === SSAFY_STAFF_YEAR;
  const sourceYears = uniqueSortedYears([
    ...readSourceYears(input),
    cohort,
    ...(isStaff ? [SSAFY_STAFF_YEAR] : []),
  ]);
  const displayName =
    readString(input, ["display_name", "displayName", "name", "nickname"]) ??
    readString(mattermost, ["display_name", "displayName", "nickname"]) ??
    mattermostUsername;

  return {
    sub: readString(input, ["sub", "ssafy_sub", "ssafySub"]),
    mattermostUserId,
    mattermostUsername,
    displayName,
    campus: readString(input, ["ssafy_campus", "campus"]),
    cohort,
    track: normalizeTrackSlug(
      readString(input, ["ssafy_track", "track", "track_slug", "trackSlug"]),
    ),
    trackName: normalizeTrackName(
      readString(input, ["ssafy_track_name", "track_name", "trackName"]),
    ),
    isStaff: Boolean(isStaff),
    sourceYears,
    profileImage: readProfileImage(input),
  };
}

export function extractSsafyVerifyMemberProfiles(
  payload: unknown,
): SsafyVerifyMemberProfile[] {
  const candidates: unknown[] = [];
  const visited = new WeakSet<object>();

  function collect(value: unknown) {
    if (typeof value !== "object" || value === null) {
      return;
    }
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        collect(item);
      }
      return;
    }

    if (!isRecord(value)) {
      return;
    }
    candidates.push(value);
    for (const key of ["users", "items", "data", "profiles", "events"]) {
      const nested = value[key];
      collect(nested);
    }
  }

  collect(payload);

  const profiles = new Map<string, SsafyVerifyMemberProfile>();
  for (const candidate of candidates) {
    const profileCandidate = isRecord(candidate)
      ? candidate.profile ?? candidate.user ?? candidate.member ?? candidate
      : candidate;
    const profile = normalizeSsafyVerifyMemberProfile(profileCandidate);
    if (profile) {
      profiles.set(profile.mattermostUserId, profile);
    }
  }

  return [...profiles.values()];
}

export function getSsafyVerifyProfileEventsNextCursor(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }
  return readString(payload, ["next_cursor", "nextCursor", "cursor"]);
}

export function toMmUserDirectorySnapshot(
  profile: SsafyVerifyMemberProfile,
  fallbackSourceYears: number[] = [],
): MmUserDirectorySnapshot {
  return {
    mmUserId: profile.mattermostUserId,
    mmUsername: profile.mattermostUsername,
    displayName: profile.displayName,
    campus: profile.campus,
    isStaff: profile.isStaff,
    sourceYears: uniqueSortedYears([
      ...fallbackSourceYears,
      ...profile.sourceYears,
      ...(profile.isStaff ? [SSAFY_STAFF_YEAR] : []),
    ]),
  };
}

export function toMemberSyncSnapshot(
  profile: SsafyVerifyMemberProfile,
): MemberSyncSnapshot {
  return {
    mmUserId: profile.mattermostUserId,
    mmUsername: profile.mattermostUsername,
    displayName: profile.displayName,
    campus: profile.campus,
    track: profile.track,
    trackName: profile.trackName,
    avatarFetched: Boolean(profile.profileImage?.base64),
    avatarUrl: profile.profileImage?.url ?? null,
    avatarContentType: profile.profileImage?.contentType ?? null,
    avatarBase64: profile.profileImage?.base64 ?? null,
  };
}

export function toSsafyVerifyMattermostUser(
  profile: SsafyVerifyMemberProfile,
): SsafyVerifyMattermostUser {
  return {
    id: profile.mattermostUserId,
    username: profile.mattermostUsername,
    nickname: profile.displayName,
    is_bot: false,
  };
}
