import { generateCode, hashCode } from "@/lib/mm-verification";
import {
  createDirectChannel,
  getUserImage,
  sendPost,
} from "@/lib/mattermost";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const CODE_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export async function getRequestCodeCooldownState(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("mm_verification_codes")
    .select("created_at")
    .eq("mm_user_id", mmUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing?.created_at) {
    return { inCooldown: false as const };
  }

  const createdAt = new Date(existing.created_at);
  const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
  return {
    inCooldown: diffSeconds < RESEND_COOLDOWN_SECONDS,
  } as const;
}

export async function clearExistingRequestCodeState(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("mm_verification_attempts")
    .delete()
    .eq("identifier", mmUserId);
  await supabase
    .from("mm_verification_codes")
    .delete()
    .eq("mm_user_id", mmUserId);
}

export async function findExistingRegisteredMember(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: existingMember } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
    )
    .eq("mm_user_id", mmUserId)
    .maybeSingle();

  return existingMember ?? null;
}

export async function deliverRequestCode(input: {
  senderToken: string;
  senderUserId: string;
  targetUserId: string;
  targetUsername: string;
  targetNickname?: string;
  targetDisplayName: string | null;
  targetCampus: string | null;
  year: number;
}) {
  const supabase = getSupabaseAdminClient();
  const avatar = await getUserImage(input.senderToken, input.targetUserId);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await supabase.from("mm_verification_codes").insert({
    code_hash: hashCode(code),
    expires_at: expiresAt.toISOString(),
    mm_user_id: input.targetUserId,
    mm_username: input.targetUsername,
    display_name: input.targetDisplayName ?? input.targetNickname ?? input.targetUsername,
    year: input.year,
    campus: input.targetCampus,
    avatar_content_type: avatar?.contentType ?? null,
    avatar_base64: avatar?.base64 ?? null,
  });

  const dmChannel = await createDirectChannel(
    input.senderToken,
    input.senderUserId,
    input.targetUserId,
  );
  await sendPost(
    input.senderToken,
    dmChannel.id,
    [
      "SSARTNERSHIP 인증코드입니다.",
      "",
      "인증코드",
      "```plaintext",
      code,
      "```",
      `유효시간: ${CODE_TTL_MINUTES}분`,
    ].join("\n"),
  );
}
