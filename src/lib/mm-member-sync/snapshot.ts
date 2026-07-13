import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import { getSsafyVerifyServerApiConfig } from "@/lib/ssafy-verify/config";
import {
  normalizeSsafyVerifyMemberProfile,
  toMemberSyncSnapshot,
} from "@/lib/ssafy-verify/profile";
import {
  SsafyVerifyServerApiError,
  createSsafyVerifyServerApiClient,
} from "@/lib/ssafy-verify/server-api";
import type { MemberSyncSnapshot } from "./shared";

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
    if (error instanceof SsafyVerifyServerApiError && error.status === 404) {
      return null;
    }
    throw error;
  });
  if (!payload) {
    return null;
  }

  const profile = normalizeSsafyVerifyMemberProfile(payload);
  return profile ? toMemberSyncSnapshot(profile) : null;
}
