import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { wrapManualMemberAddDbError } from "./shared";
import type { ExistingMemberRecord } from "./lookup";

export async function rollbackManualMemberProvision(input: {
  memberId: string | null;
  existingMember: ExistingMemberRecord | null;
}) {
  if (!input.memberId) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  if (!input.existingMember) {
    const { error } = await supabase.from("members").delete().eq("id", input.memberId);
    if (error) {
      throw wrapManualMemberAddDbError(
        error,
        "기존 회원 정보를 되돌리지 못했습니다.",
      );
    }
    return;
  }

  const { error } = await supabase
    .from("members")
    .update({
      mm_user_id: input.existingMember.mm_user_id,
      mm_username: input.existingMember.mm_username,
      display_name: input.existingMember.display_name ?? null,
      year: input.existingMember.year,
      campus: input.existingMember.campus ?? null,
      password_hash: input.existingMember.password_hash ?? null,
      password_salt: input.existingMember.password_salt ?? null,
      must_change_password: Boolean(input.existingMember.must_change_password),
      avatar_content_type: input.existingMember.avatar_content_type ?? null,
      avatar_base64: input.existingMember.avatar_base64 ?? null,
      updated_at: input.existingMember.updated_at ?? new Date().toISOString(),
    })
    .eq("id", input.memberId);

  if (error) {
    throw wrapManualMemberAddDbError(
      error,
      "기존 회원 정보를 되돌리지 못했습니다.",
    );
  }
}
