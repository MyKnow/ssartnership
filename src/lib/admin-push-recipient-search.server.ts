import {
  getMockMemberById,
  isMockDataSource,
  MOCK_MEMBER_ID,
} from "@/lib/mock/member";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const DEFAULT_RECIPIENT_LIMIT = 30;
const MAX_RECIPIENT_LIMIT = 50;
const MAX_RECIPIENT_QUERY_LENGTH = 80;

export type AdminPushRecipientOption = {
  id: string;
  display_name: string | null;
  mm_username: string;
  year: number | null;
  campus: string | null;
};

type RecipientMemberRow = {
  id: string;
  display_name: string | null;
  mattermost_account_id: string | null;
  generation: number | null;
  campus: string | null;
  directory:
    | {
        mm_username: string | null;
      }
    | {
        mm_username: string | null;
      }[]
    | null;
};

type DirectoryMatchRow = {
  id: string;
};

export function normalizeAdminPushRecipientSearch(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_RECIPIENT_QUERY_LENGTH);
}

function getSafeSearchPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

function normalizeLimit(value: number | null | undefined) {
  const parsed = Number.isFinite(value) ? Math.trunc(value as number) : DEFAULT_RECIPIENT_LIMIT;
  return Math.min(MAX_RECIPIENT_LIMIT, Math.max(1, parsed));
}

function toMockRecipientOptions() {
  const member = getMockMemberById(MOCK_MEMBER_ID);
  if (!member) {
    return [] satisfies AdminPushRecipientOption[];
  }

  return [{
    id: member.id,
    display_name: member.displayName,
    mm_username: member.mattermostUsername,
    year: member.generation,
    campus: member.campus,
  }] satisfies AdminPushRecipientOption[];
}

function mergeMemberRows(...groups: RecipientMemberRow[][]) {
  const byId = new Map<string, RecipientMemberRow>();
  for (const group of groups) {
    for (const member of group) {
      byId.set(member.id, member);
    }
  }
  return [...byId.values()];
}

function resolveDirectoryUsername(
  directory: RecipientMemberRow["directory"],
) {
  const entry = Array.isArray(directory) ? directory[0] : directory;
  return entry?.mm_username ?? "";
}

/**
 * Searchable recipient options for the personal notification audience picker.
 * The public admin page never ships the entire member directory to the browser.
 */
export async function listAdminPushRecipientOptions({
  query,
  limit,
}: {
  query?: string | null;
  limit?: number | null;
} = {}): Promise<{ recipients: AdminPushRecipientOption[]; failed: boolean }> {
  const normalizedQuery = normalizeAdminPushRecipientSearch(query);
  const safeLimit = normalizeLimit(limit);

  if (isMockDataSource()) {
    const mockResults = toMockRecipientOptions();
    return {
      recipients: normalizedQuery
        ? mockResults.filter((member) =>
            [member.display_name ?? "", member.mm_username, member.campus ?? ""]
              .join(" ")
              .toLocaleLowerCase("ko-KR")
              .includes(normalizedQuery.toLocaleLowerCase("ko-KR")),
          )
        : mockResults,
      failed: false,
    };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const memberFields =
      "id,display_name,mattermost_account_id,generation,campus,directory:mm_user_directory!members_mattermost_account_id_fkey(mm_username)";
    const memberQuery = supabase
      .from("members")
      .select(memberFields)
      .is("deleted_at", null)
      .order("display_name", { ascending: true })
      .limit(safeLimit);

    let accountMatchedMembers: RecipientMemberRow[] = [];
    let memberResult: Awaited<typeof memberQuery>;
    if (normalizedQuery) {
      const [nameResult, directoryResult] = await Promise.all([
        memberQuery.ilike("display_name", getSafeSearchPattern(normalizedQuery)),
        supabase
          .from("mm_user_directory")
          .select("id")
          .eq("is_active", true)
          .ilike("mm_username", getSafeSearchPattern(normalizedQuery))
          .limit(safeLimit),
      ]);
      memberResult = nameResult;
      if (memberResult.error) {
        return { recipients: [], failed: true };
      }
      if (directoryResult.error) {
        return { recipients: [], failed: true };
      }

      const matchingAccountIds = (directoryResult.data ?? []).map(
        (entry: DirectoryMatchRow) => entry.id,
      );
      if (matchingAccountIds.length > 0) {
        const accountMemberResult = await supabase
          .from("members")
          .select(memberFields)
          .is("deleted_at", null)
          .in("mattermost_account_id", matchingAccountIds)
          .order("display_name", { ascending: true })
          .limit(safeLimit);
        if (accountMemberResult.error) {
          return { recipients: [], failed: true };
        }
        accountMatchedMembers = (accountMemberResult.data ?? []) as RecipientMemberRow[];
      }
    } else {
      memberResult = await memberQuery;
      if (memberResult.error) {
        return { recipients: [], failed: true };
      }
    }

    const members = mergeMemberRows(
      (memberResult.data ?? []) as RecipientMemberRow[],
      accountMatchedMembers,
    ).slice(0, safeLimit);
    return {
      recipients: members.map((member) => ({
        id: member.id,
        display_name: member.display_name,
        mm_username: resolveDirectoryUsername(member.directory),
        year: member.generation,
        campus: member.campus,
      })),
      failed: false,
    };
  } catch {
    return { recipients: [], failed: true };
  }
}
