import {
  getConfiguredBackfillableSsafyYears,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  getSenderCredentials,
  getUserById,
  getUserImage,
  loginWithPassword,
} from "@/lib/mattermost";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  makeSnapshot,
  MmMemberSyncError,
  type MemberRow,
  type MemberSyncSnapshot,
  type SenderSession,
  wrapMmMemberSyncDbError,
} from "./shared";

export async function getSenderSessionForYear(
  year: number,
  cache: Map<number, Promise<SenderSession>>,
) {
  const cached = cache.get(year);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const credentials = getSenderCredentials(year);
    const senderLogin = await loginWithPassword(
      credentials.loginId,
      credentials.password,
    );
    return {
      year,
      token: senderLogin.token,
    } satisfies SenderSession;
  })();

  cache.set(year, promise);

  try {
    return await promise;
  } catch (error) {
    cache.delete(year);
    throw error;
  }
}

export async function fetchMemberSnapshotByUserId(
  token: string,
  userId: string,
): Promise<MemberSyncSnapshot | null> {
  const user = await getUserById(token, userId);
  if (!user) {
    return null;
  }

  const avatar = await getUserImage(token, userId);
  return makeSnapshot(user, avatar);
}

export async function resolveMemberSnapshotForYears(
  member: MemberRow,
  candidateYears: number[],
  cache: Map<number, Promise<SenderSession>>,
) {
  let lastError: Error | null = null;

  for (const senderYear of candidateYears) {
    try {
      const sender = await getSenderSessionForYear(senderYear, cache);
      const snapshot = await fetchMemberSnapshotByUserId(
        sender.token,
        member.mm_user_id,
      );
      if (!snapshot) {
        continue;
      }
      return {
        senderYear,
        senderToken: sender.token,
        snapshot,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("MM 사용자 조회 실패");
    }
  }

  if (lastError) {
    throw new MmMemberSyncError(
      "lookup_failed",
      lastError.message || "MM 사용자 조회 실패",
    );
  }

  return null;
}

export async function loadBackfillableMembers() {
  const supabase = getSupabaseAdminClient();
  const cycleSettings = await getSsafyCycleSettings();
  const years = getConfiguredBackfillableSsafyYears(cycleSettings);
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
    )
    .in("year", years)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }

  return {
    years,
    members: (members ?? []) as MemberRow[],
  };
}

export async function loadMemberById(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: member, error } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw wrapMmMemberSyncDbError(error, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member?.id) {
    return null;
  }

  return member as MemberRow;
}

export { getMemberSyncCandidateYears } from "./shared";
