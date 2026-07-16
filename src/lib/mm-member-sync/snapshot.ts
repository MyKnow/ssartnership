import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import { getSsafyVerifyServerApiConfig } from "@/lib/ssafy-verify/config";
import {
  extractSsafyVerifyMemberProfiles,
  toMemberSyncSnapshot,
} from "@/lib/ssafy-verify/profile";
import {
  SsafyVerifyServerApiError,
  createSsafyVerifyServerApiClient,
} from "@/lib/ssafy-verify/server-api";
import { MemberProfileSyncError } from "@/lib/member-profile-sync-errors";
import {
  parseMattermostLifecycleBatch,
  type MattermostLifecycleResult,
} from "./lifecycle";
import type { MemberSyncSnapshot } from "./shared";

const MATTERMOST_PROFILE_NOT_FOUND = Symbol("mattermost_profile_not_found");

export function createMemberSyncApiClient(input: {
  identifier: string;
  flow: string;
  mattermostUserIds?: readonly string[];
}) {
  return createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
    trace: createSsafyVerifyApiTraceLogger({
      actorType: "system",
      identifier: input.identifier,
      properties: {
        flow: input.flow,
        ...(input.mattermostUserIds
          ? { mattermostUserIdCount: input.mattermostUserIds.length }
          : {}),
      },
    }),
  });
}

function isNotFound(error: unknown) {
  return error instanceof SsafyVerifyServerApiError && error.status === 404;
}

export async function fetchMemberSnapshotByUserId(
  userId: string,
  clientOverride?: ReturnType<typeof createSsafyVerifyServerApiClient>,
): Promise<MemberSyncSnapshot | null> {
  const client = clientOverride
    ?? createMemberSyncApiClient({
      identifier: userId,
      flow: "member_profile_sync",
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

  const profiles = extractSsafyVerifyMemberProfiles(payload);
  const profile = profiles.find(
    (candidate) => candidate.mattermostUserId === userId,
  );
  if (!profile) {
    if (profiles.length > 0) {
      throw new MemberProfileSyncError("identity_mismatch");
    }
    throw new MemberProfileSyncError("provider_response_invalid");
  }
  return toMemberSyncSnapshot(profile);
}

export async function fetchMemberLifecycleByUserId(
  userId: string,
  clientOverride?: ReturnType<typeof createSsafyVerifyServerApiClient>,
): Promise<MattermostLifecycleResult | null> {
  const client = clientOverride
    ?? createMemberSyncApiClient({
      identifier: userId,
      flow: "member_lifecycle_sync",
    });
  const payload = await client.getMattermostUserLifecyclesBatch([userId]);
  return parseMattermostLifecycleBatch(payload, [userId]).results.get(userId) ?? null;
}
