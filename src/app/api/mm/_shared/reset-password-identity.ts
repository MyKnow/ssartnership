import {
  findMmUserDirectoryEntryByUsername,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import {
  resolveSelectableMemberByUsername,
} from "@/lib/ssafy-verify/directory";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type DirectoryEntry = Awaited<ReturnType<typeof findMmUserDirectoryEntryByUsername>>;
type ResetPasswordMember = {
  id: string;
  mattermost_account_id: string | null;
  display_name: string | null;
  generation: number;
  staff_source_generation: number | null;
  campus: string | null;
  active_profile_image_id: string | null;
  updated_at: string | null;
};

export type ResetPasswordMemberResolution =
  | {
      kind: "resolved";
      directoryEntry: NonNullable<DirectoryEntry>;
      resolvedStudentYear: number | null;
      member: ResetPasswordMember;
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
    "id,mattermost_account_id,display_name,generation,staff_source_generation,campus,active_profile_image_id,updated_at";
  let directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  let resolvedStudentYear: number | null = null;
  let member: ResetPasswordMember | null = null;

  if (!directoryEntry?.id) {
    const resolved = await resolveSelectableMemberByUsername(username);
    if (resolved) {
      resolvedStudentYear = resolved.year;
      if (resolved.directorySnapshot) {
        await upsertMmUserDirectorySnapshot(resolved.directorySnapshot);
      }
      directoryEntry = await findMmUserDirectoryEntryByUsername(username);
    }
  }

  if (!directoryEntry?.id) {
    return {
      kind: "not_registered",
    };
  }

  const { data: memberById } = await supabase
    .from("members")
    .select(memberSelect)
    .eq("mattermost_account_id", directoryEntry.id)
    .is("deleted_at", null)
    .maybeSingle();
  member = (memberById as ResetPasswordMember | null) ?? null;

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
