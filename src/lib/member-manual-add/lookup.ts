import {
  findUserInChannelByUsername,
  getSenderCredentials,
  getStudentChannelConfig,
  loginWithPassword,
  type MMUser,
} from "@/lib/mattermost";
import type { MemberRow } from "@/lib/mm-member-sync";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  MANUAL_MEMBER_ADD_YEAR_FALLBACKS,
  type ManualMemberAddYear,
  type SenderSession,
  wrapManualMemberAddDbError,
} from "./shared";

const MEMBER_SELECT =
  "id,mm_user_id,mm_username,display_name,year,campus,password_hash,password_salt,must_change_password,avatar_content_type,avatar_base64,updated_at";

export type ManualMemberResolution = {
  requestedYear: ManualMemberAddYear;
  resolvedYear: number;
  senderToken: string;
  senderUserId: string;
  user: MMUser;
};

export type ExistingMemberRecord = MemberRow & {
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean;
};

export async function getSenderSession(
  year: number,
  cache: Map<number, Promise<SenderSession>>,
) {
  const cached = cache.get(year);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const credentials = getSenderCredentials(year);
    const login = await loginWithPassword(credentials.loginId, credentials.password);
    return {
      token: login.token,
      userId: login.user.id,
    };
  })();

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
      const sender = await getSenderSession(year, cache);
      const channelConfig = getStudentChannelConfig(year);
      const user = await findUserInChannelByUsername(
        sender.token,
        username,
        channelConfig,
      );
      if (!user) {
        continue;
      }
      return {
        requestedYear,
        resolvedYear: year,
        senderToken: sender.token,
        senderUserId: sender.userId,
        user,
      };
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error("MM 사용자 조회 실패");
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
  const supabase = getSupabaseAdminClient();

  const byUserId = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("mm_user_id", userId)
    .maybeSingle();
  if (byUserId.error) {
    throw wrapManualMemberAddDbError(
      byUserId.error,
      "기존 회원 정보를 불러오지 못했습니다.",
    );
  }
  if (byUserId.data?.id) {
    return byUserId.data as ExistingMemberRecord;
  }

  return null;
}
