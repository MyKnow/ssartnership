import {
  buildDirectMemberCreatePayload,
  type DirectMemberCreateValue,
} from "@/lib/member-direct-create";
import { hashPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type DirectMemberProvisionErrorCode =
  | "duplicate_login_id"
  | "mattermost_username_conflict"
  | "save_failed";

export class DirectMemberProvisionError extends Error {
  constructor(readonly code: DirectMemberProvisionErrorCode) {
    super(code);
  }
}

export async function provisionDirectMember(input: DirectMemberCreateValue) {
  const password = hashPassword(input.temporaryPassword);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data: directoryMember, error: directoryError } = await supabase
    .from("mm_user_directory")
    .select("id")
    .eq("mm_username", input.manualLoginId)
    .maybeSingle();
  if (directoryError) {
    throw new DirectMemberProvisionError("save_failed");
  }
  if (directoryMember?.id) {
    throw new DirectMemberProvisionError("mattermost_username_conflict");
  }
  const { data, error } = await supabase
    .from("members")
    .insert({
      ...buildDirectMemberCreatePayload({
        manualLoginId: input.manualLoginId,
        displayName: input.displayName,
        generation: input.generation,
        campus: input.campus,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        now,
      }),
      created_at: now,
    })
    .select("id,manual_login_id,display_name")
    .single();

  if (error || !data?.id || !data.manual_login_id || !data.display_name) {
    if (error?.code === "23505") {
      throw new DirectMemberProvisionError("duplicate_login_id");
    }
    throw new DirectMemberProvisionError("save_failed");
  }

  return {
    id: data.id as string,
    manualLoginId: data.manual_login_id as string,
    displayName: data.display_name as string,
  };
}
