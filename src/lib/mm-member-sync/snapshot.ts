import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import { getSsafyVerifyServerApiConfig } from "@/lib/ssafy-verify/config";
import {
  extractSsafyVerifyMemberProfiles,
  normalizeSsafyVerifyMemberProfile,
  toMemberSyncSnapshot,
} from "@/lib/ssafy-verify/profile";
import {
  SsafyVerifyServerApiError,
  createSsafyVerifyServerApiClient,
} from "@/lib/ssafy-verify/server-api";
import { MemberProfileSyncError } from "@/lib/member-profile-sync-errors";
import type { MemberSyncSnapshot } from "./shared";

const MATTERMOST_PROFILE_NOT_FOUND = Symbol("mattermost_profile_not_found");

function isNotFound(error: unknown) {
  return error instanceof SsafyVerifyServerApiError && error.status === 404;
}

function isExplicitlyEmptyDirectoryLookup(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.length === 0;
  }
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return ["users", "items", "data", "profiles", "events"].some(
    (key) => Array.isArray(record[key]) && record[key].length === 0,
  );
}

export async function fetchMemberSnapshotByUserId(
  userId: string,
  clientOverride?: ReturnType<typeof createSsafyVerifyServerApiClient>,
): Promise<MemberSyncSnapshot | null> {
  const client = clientOverride
    ?? createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
      trace: createSsafyVerifyApiTraceLogger({
        actorType: "system",
        identifier: userId,
        properties: {
          flow: "member_profile_sync",
          mattermostUserId: userId,
        },
      }),
    });
  const payload = await client.getMattermostUserProfile(userId).catch((error) => {
    if (isNotFound(error)) {
      return MATTERMOST_PROFILE_NOT_FOUND;
    }
    throw error;
  });
  if (payload === MATTERMOST_PROFILE_NOT_FOUND) {
    return null;
  }

  const profile = normalizeSsafyVerifyMemberProfile(payload);
  if (!profile) {
    throw new MemberProfileSyncError("provider_response_invalid");
  }
  return toMemberSyncSnapshot(profile);
}

export async function fetchMemberSnapshotByUsername(input: {
  username: string;
  generation: number | null;
  clientOverride?: ReturnType<typeof createSsafyVerifyServerApiClient>;
}): Promise<MemberSyncSnapshot | null> {
  const username = input.username.trim().toLowerCase();
  const client = input.clientOverride
    ?? createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
      trace: createSsafyVerifyApiTraceLogger({
        actorType: "system",
        identifier: username,
        properties: {
          flow: "member_profile_sync_username_fallback",
          mattermostUsername: username,
          generation: input.generation,
        },
      }),
    });
  const payload = await client.findMattermostUsers({
    username,
    ...(input.generation && input.generation > 0
      ? { cohort: input.generation }
      : {}),
  }).catch((error) => {
    if (isNotFound(error)) {
      return MATTERMOST_PROFILE_NOT_FOUND;
    }
    throw error;
  });
  if (payload === MATTERMOST_PROFILE_NOT_FOUND) {
    return null;
  }

  const profiles = extractSsafyVerifyMemberProfiles(payload);
  const matchingProfile = profiles.find((profile) =>
    profile.mattermostUsername.toLowerCase() === username
    && (input.generation === 0 ? profile.isStaff : !profile.isStaff),
  );
  if (!matchingProfile) {
    if (profiles.length > 0) {
      throw new MemberProfileSyncError("identity_mismatch");
    }
    if (isExplicitlyEmptyDirectoryLookup(payload)) {
      return null;
    }
    throw new MemberProfileSyncError("provider_response_invalid");
  }
  return toMemberSyncSnapshot(matchingProfile);
}
