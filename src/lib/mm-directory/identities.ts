import { getSupabaseAdminClient } from "../supabase/server.ts";
import { collectRowsByFilterChunks } from "../supabase/paging.ts";

export type MmUserDirectoryIdentity = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string;
  campus: string | null;
  is_staff: boolean;
  source_years: number[];
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

  const supabase = getSupabaseAdminClient();
  const result = await collectRowsByFilterChunks<
    string,
    MmUserDirectoryIdentity
  >(uniqueAccountIds, async (accountIdChunk) => {
    const { data, error } = await supabase
      .from("mm_user_directory")
      .select(
        "id,mm_user_id,mm_username,display_name,campus,is_staff,source_years,is_active",
      )
      .in("id", [...accountIdChunk]);
    if (error) {
      throw new Error("MM 유저 디렉터리를 불러오지 못했습니다.");
    }
    return {
      rows: (data ?? []) as MmUserDirectoryIdentity[],
      error: false,
    };
  });

  return new Map(
    result.rows.map((entry) => [
      entry.id,
      entry,
    ]),
  );
}
