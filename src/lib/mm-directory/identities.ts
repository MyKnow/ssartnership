import { getSupabaseAdminClient } from "../supabase/server.ts";

export type MmUserDirectoryIdentity = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string;
  campus: string | null;
  is_active: boolean;
};

export async function getMmUserDirectoryEntriesByAccountIds(
  accountIds: readonly string[],
) {
  const uniqueAccountIds = Array.from(
    new Set(accountIds.filter((accountId) => Boolean(accountId?.trim()))),
  );
  if (uniqueAccountIds.length === 0) {
    return new Map<string, MmUserDirectoryIdentity>();
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("mm_user_directory")
    .select("id,mm_user_id,mm_username,display_name,campus,is_active")
    .in("id", uniqueAccountIds);
  if (error) {
    throw new Error("MM 유저 디렉터리를 불러오지 못했습니다.");
  }

  return new Map(
    ((data ?? []) as MmUserDirectoryIdentity[]).map((entry) => [
      entry.id,
      entry,
    ]),
  );
}
