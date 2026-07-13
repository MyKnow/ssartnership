import { findMmUserDirectoryEntryByUserId } from "@/lib/mm-directory";
import { getSsafyVerifyServerApiConfig } from "@/lib/ssafy-verify/config";
import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import { createSsafyVerifyServerApiClient } from "@/lib/ssafy-verify/server-api";
import {
  extractSsafyVerifyMemberProfiles,
  toSsafyVerifyMattermostUser,
  type SsafyVerifyMattermostUser,
  type SsafyVerifyMemberProfile,
} from "@/lib/ssafy-verify/profile";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  MANUAL_MEMBER_ADD_YEAR_FALLBACKS,
  type ManualMemberAddYear,
  type SenderSession,
  wrapManualMemberAddDbError,
} from "./shared";

const MEMBER_SELECT =
  "id,mattermost_account_id,display_name,generation,staff_source_generation,campus,password_hash,password_salt,must_change_password,active_profile_image_id,profile_photo_review_status,updated_at";

export type ManualMemberResolution = {
  requestedYear: ManualMemberAddYear;
  resolvedYear: number;
  user: SsafyVerifyMattermostUser;
  profile: SsafyVerifyMemberProfile;
};

export type ExistingMemberRecord = {
  id: string;
  mattermost_account_id: string | null;
  display_name: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  campus: string | null;
  password_hash: string | null;
  password_salt: string | null;
  must_change_password: boolean | null;
  active_profile_image_id: string | null;
  profile_photo_review_status: string | null;
  updated_at: string | null;
};

export async function getSenderSession(
  year: number,
  cache: Map<number, Promise<SenderSession>>,
) {
  const cached = cache.get(year);
  if (cached) {
    return cached;
  }

  const promise = (async () => ({ year }))();
  cache.set(year, promise);

  try {
    return await promise;
  } catch (error) {
    cache.delete(year);
    throw error;
  }
}

export async function resolveManualMemberResolution(
  username: string,
  requestedYear: ManualMemberAddYear,
  cache: Map<number, Promise<SenderSession>>,
): Promise<ManualMemberResolution | null> {
  const yearsToTry =
    requestedYear === 0 ? MANUAL_MEMBER_ADD_YEAR_FALLBACKS : [requestedYear];
  let lastError: Error | null = null;

  for (const year of yearsToTry) {
    try {
      await getSenderSession(year, cache);
      const client = createSsafyVerifyServerApiClient(
        getSsafyVerifyServerApiConfig(),
        {
          trace: createSsafyVerifyApiTraceLogger({
            actorType: "system",
            identifier: username,
            properties: {
              flow: "manual_member_add_lookup",
              username,
              requestedYear,
              lookupYear: year,
            },
          }),
        },
      );
      const payload = await client.findMattermostUsers({
        username,
        cohort: year,
      });
      const profile = extractSsafyVerifyMemberProfiles(payload).find((item) =>
        requestedYear === 0 ? item.isStaff : !item.isStaff,
      );
      if (!profile) {
        continue;
      }
      return {
        requestedYear,
        resolvedYear: year,
        user: toSsafyVerifyMattermostUser(profile),
        profile,
      };
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error("SSAFY Verify 사용자 조회 실패");
      if (requestedYear !== 0) {
        throw normalized;
      }
      lastError = normalized;
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

export async function findExistingMemberByMmUser(userId: string) {
  const directory = await findMmUserDirectoryEntryByUserId(userId);
  if (!directory?.id) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("mattermost_account_id", directory.id)
    .maybeSingle();
  if (error) {
    throw wrapManualMemberAddDbError(
      error,
      "기존 회원 정보를 불러오지 못했습니다.",
    );
  }
  return (data as ExistingMemberRecord | null) ?? null;
}
