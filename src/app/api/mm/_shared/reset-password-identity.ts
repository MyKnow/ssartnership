import {
  findMmUserDirectoryEntryByUsername,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import {
  resolveSelectableMemberByUsername,
} from "@/lib/ssafy-verify/directory";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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
    "id,mm_user_id,mm_username,display_name,year,staff_source_year,campus,avatar_content_type,avatar_base64,avatar_url,updated_at";
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
    const resolved = await resolveSelectableMemberByUsername(username);
    if (resolved) {
      resolvedStudentYear = resolved.year;
      if (resolved.directorySnapshot) {
        await upsertMmUserDirectorySnapshot(resolved.directorySnapshot);
      }
      const { data: memberById } = await supabase
        .from("members")
        .select(memberSelect)
        .eq("mm_user_id", resolved.user.id)
        .maybeSingle();
      member = (memberById as MemberRow | null) ?? null;
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
