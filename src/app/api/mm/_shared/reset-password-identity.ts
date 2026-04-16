import {
  findMmUserDirectoryEntryByUsername,
} from "@/lib/mm-directory";
import {
  resolveSelectableMemberByUsername,
} from "@/lib/mattermost";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isMattermostApiError, upsertDirectorySnapshotFromMmUser } from "./mattermost";
import type { MemberRow } from "@/lib/mm-member-sync";

type DirectoryEntry = Awaited<ReturnType<typeof findMmUserDirectoryEntryByUsername>>;

export type ResetPasswordMemberResolution =
  | {
      kind: "resolved";
      directoryEntry: DirectoryEntry;
      resolvedStudentYear: number | null;
      member: MemberRow;
    }
  | {
      kind: "inaccessible";
      status: number;
    }
  | {
      kind: "not_registered";
    };

export async function resolveResetPasswordMember(
  username: string,
): Promise<ResetPasswordMemberResolution> {
  const supabase = getSupabaseAdminClient();
  const memberSelect =
    "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at";
  const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  let resolvedStudentYear: number | null = null;
  let member: MemberRow | null = null;

  if (directoryEntry?.mm_user_id) {
    const { data: memberById } = await supabase
      .from("members")
      .select(memberSelect)
      .eq("mm_user_id", directoryEntry.mm_user_id)
      .maybeSingle();
    member = (memberById as MemberRow | null) ?? null;
  } else {
    try {
      const resolved = await resolveSelectableMemberByUsername(username);
      if (resolved) {
        resolvedStudentYear = resolved.year;
        await upsertDirectorySnapshotFromMmUser(resolved.user, [resolved.year]);
        const { data: memberById } = await supabase
          .from("members")
          .select(memberSelect)
          .eq("mm_user_id", resolved.user.id)
          .maybeSingle();
        member = (memberById as MemberRow | null) ?? null;
      }
    } catch (error) {
      if (isMattermostApiError(error)) {
        return {
          kind: "inaccessible",
          status: error.status,
        };
      }
      throw error;
    }
  }

  if (!member?.id) {
    return {
      kind: "not_registered",
    };
  }

  return {
    kind: "resolved",
    directoryEntry,
    resolvedStudentYear,
    member,
  };
}
