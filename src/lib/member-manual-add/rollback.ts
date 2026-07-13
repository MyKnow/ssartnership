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
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", input.memberId);
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
      mattermost_account_id: input.existingMember.mattermost_account_id,
      display_name: input.existingMember.display_name ?? null,
      generation: input.existingMember.generation,
      staff_source_generation: input.existingMember.staff_source_generation,
      campus: input.existingMember.campus ?? null,
      password_hash: input.existingMember.password_hash ?? null,
      password_salt: input.existingMember.password_salt ?? null,
      must_change_password: Boolean(input.existingMember.must_change_password),
      active_profile_image_id: input.existingMember.active_profile_image_id,
      profile_photo_review_status:
        input.existingMember.profile_photo_review_status ?? null,
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
