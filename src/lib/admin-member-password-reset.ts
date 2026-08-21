import {
  buildMemberPasswordSetupUrl,
  sendMemberPasswordResetEmail,
} from "@/lib/member-password-action-email";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

type AdminMemberPasswordResetMember = {
  id: string;
  display_name: string | null;
  email_normalized: string | null;
};

export type AdminMemberPasswordResetDelivery = "copy" | "email";

export class AdminMemberPasswordResetError extends Error {
  constructor(
    readonly code:
      | "member_not_found"
      | "email_not_available"
      | "issue_failed"
      | "email_delivery_failed",
  ) {
    super(code);
    this.name = "AdminMemberPasswordResetError";
  }
}

async function getActiveMember(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id,display_name,email_normalized")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new AdminMemberPasswordResetError("issue_failed");
  }
  if (!data?.id) {
    throw new AdminMemberPasswordResetError("member_not_found");
  }
  return data as AdminMemberPasswordResetMember;
}

async function createAdminPasswordResetAction(memberId: string) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  const supabase = getSupabaseAdminClient();
  const { error: consumeError } = await supabase
    .from("member_password_action_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .in("purpose", ["admin_password_reset", "manual_password_reset"])
    .is("consumed_at", null);
  if (consumeError) {
    throw new AdminMemberPasswordResetError("issue_failed");
  }

  const { error: insertError } = await supabase
    .from("member_password_action_tokens")
    .insert({
      member_id: memberId,
      purpose: "admin_password_reset",
      // An administrator can hand the link to a member without proving email
      // ownership, so completion must not treat this as email verification.
      delivery_channel: "admin",
      token_hash: hashOpaqueToken(token),
      expires_at: expiresAt,
    });
  if (insertError) {
    throw new AdminMemberPasswordResetError("issue_failed");
  }

  return { token, expiresAt };
}

export async function issueAdminMemberPasswordReset(input: {
  memberId: string;
  delivery: AdminMemberPasswordResetDelivery;
}) {
  const member = await getActiveMember(input.memberId);
  // Delivery to the stored address proves email ownership only when the
  // recipient completes that email-channel token. A copied admin link remains
  // a manual channel and intentionally does not verify an email address.
  if (input.delivery === "email" && !member.email_normalized) {
    throw new AdminMemberPasswordResetError("email_not_available");
  }

  const { token } = await createAdminPasswordResetAction(member.id);
  const resetUrl = buildMemberPasswordSetupUrl(token);

  if (input.delivery === "email") {
    try {
      await sendMemberPasswordResetEmail({
        email: member.email_normalized as string,
        displayName: member.display_name ?? "회원",
        token,
      });
    } catch {
      throw new AdminMemberPasswordResetError("email_delivery_failed");
    }
  }

  return {
    resetUrl: input.delivery === "copy" ? resetUrl : null,
  };
}
