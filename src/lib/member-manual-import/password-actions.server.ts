import { createHmacDigest } from "@/lib/hmac.js";
import { readSessionSecret } from "@/lib/session-secrets";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { sendMemberPasswordResetEmail } from "@/lib/member-password-action-email";
const PASSWORD_ACTION_TTL_MS = 24 * 60 * 60 * 1000;

function getManualMemberImportTokenSecret() {
  return readSessionSecret("manual-member-import-token", {
    errorMessage: "수동 회원 가져오기 토큰 비밀값이 필요합니다.",
  });
}

function getManualMemberImportSetupToken(rowId: string) {
  return createHmacDigest(
    `manual-member-import-setup:${rowId}`,
    getManualMemberImportTokenSecret(),
    "hex",
  );
}

async function createManualPasswordAction(input: {
  memberId: string;
  purpose: "manual_initial_setup" | "manual_password_reset";
  deliveryChannel: "mattermost" | "email";
}) {
  const token = generateOpaqueToken();
  const supabase = getSupabaseAdminClient();
  const { error: consumeError } = await supabase
    .from("member_password_action_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("member_id", input.memberId)
    .eq("purpose", input.purpose)
    .is("consumed_at", null);
  if (consumeError) throw new Error("기존 설정 링크를 정리하지 못했습니다.");
  const { error } = await supabase.from("member_password_action_tokens").insert({
    member_id: input.memberId,
    purpose: input.purpose,
    delivery_channel: input.deliveryChannel,
    token_hash: hashOpaqueToken(token),
    expires_at: new Date(Date.now() + PASSWORD_ACTION_TTL_MS).toISOString(),
  });
  if (error) throw new Error("비밀번호 설정 링크를 준비하지 못했습니다.");
  return token;
}

export async function createManualInitialSetupReissueAction(input: {
  memberId: string;
  deliveryChannel: "mattermost" | "email";
}) {
  const token = generateOpaqueToken();
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reissue_manual_member_initial_setup",
    {
      p_member_id: input.memberId,
      p_delivery_channel: input.deliveryChannel,
      p_token_hash: hashOpaqueToken(token),
      p_expires_at: new Date(Date.now() + PASSWORD_ACTION_TTL_MS).toISOString(),
    },
  );
  if (error || data !== input.memberId) {
    throw new Error("초기 설정 링크를 발급할 수 있는 회원 상태가 아닙니다.");
  }
  return token;
}

type ActiveManualPasswordAction = {
  id: string;
  token_hash: string;
};

async function findActiveManualPasswordAction(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_password_action_tokens")
    .select("id,token_hash")
    .eq("member_id", memberId)
    .eq("purpose", "manual_initial_setup")
    .is("consumed_at", null)
    .maybeSingle();
  if (error) throw new Error("기존 설정 링크를 확인하지 못했습니다.");
  return (data as ActiveManualPasswordAction | null) ?? null;
}

export async function ensureManualMemberImportPasswordAction(input: {
  memberId: string;
  rowId: string;
  deliveryChannel: "mattermost" | "email";
}) {
  const token = getManualMemberImportSetupToken(input.rowId);
  const tokenHash = hashOpaqueToken(token);
  const existing = await findActiveManualPasswordAction(input.memberId);
  if (existing) {
    if (existing.token_hash !== tokenHash) {
      throw new Error("기존 설정 링크가 있어 수동 가져오기를 재개할 수 없습니다.");
    }
    const { error } = await getSupabaseAdminClient()
      .from("member_password_action_tokens")
      .update({ delivery_channel: input.deliveryChannel })
      .eq("id", existing.id);
    if (error) throw new Error("설정 링크 전달 경로를 저장하지 못했습니다.");
    return token;
  }

  const { error: insertError } = await getSupabaseAdminClient()
    .from("member_password_action_tokens")
    .insert({
      member_id: input.memberId,
      purpose: "manual_initial_setup",
      delivery_channel: input.deliveryChannel,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + PASSWORD_ACTION_TTL_MS).toISOString(),
    });
  if (!insertError) return token;

  const claimedByConcurrentWorker = await findActiveManualPasswordAction(input.memberId);
  if (claimedByConcurrentWorker?.token_hash === tokenHash) return token;
  throw new Error("비밀번호 설정 링크를 준비하지 못했습니다.");
}

export async function completeManualMemberPasswordAction(input: {
  token: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "complete_member_password_action_with_delivery",
    {
      p_token_hash: hashOpaqueToken(input.token),
      p_password_hash: input.passwordHash,
      p_password_salt: input.passwordSalt,
    },
  );
  const completion = data as Record<string, unknown> | null;
  if (
    error
    || !completion
    || typeof completion.memberId !== "string"
    || (completion.deliveryChannel !== "email"
      && completion.deliveryChannel !== "mattermost"
      && completion.deliveryChannel !== "admin")
    || (completion.authenticationMethod !== "email"
      && completion.authenticationMethod !== "manual"
      && completion.authenticationMethod !== "mattermost")
  ) {
    return null;
  }
  return {
    memberId: completion.memberId,
    deliveryChannel: completion.deliveryChannel as "email" | "mattermost" | "admin",
    authenticationMethod: completion.authenticationMethod as "email" | "manual" | "mattermost",
  };
}

export type ManualMemberPasswordResetIssueResult =
  | {
      ok: true;
      reason: "issued";
    }
  | {
      ok: false;
      reason: "not_found" | "already_pending";
    };

export async function issueManualMemberPasswordReset(
  email: string,
): Promise<ManualMemberPasswordResetIssueResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id,display_name,email_normalized,must_change_password")
    .eq("email_normalized", email)
    .not("email_verified_at", "is", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data?.id || !data.email_normalized) {
    return { ok: false, reason: "not_found" };
  }
  if (data.must_change_password) {
    return { ok: false, reason: "already_pending" };
  }
  const token = await createManualPasswordAction({
    memberId: data.id as string,
    purpose: "manual_password_reset",
    deliveryChannel: "email",
  });
  await sendMemberPasswordResetEmail({
    email: data.email_normalized as string,
    displayName: String(data.display_name ?? "회원"),
    token,
  });
  return { ok: true, reason: "issued" };
}
