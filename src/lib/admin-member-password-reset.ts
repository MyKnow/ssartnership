import {
  buildMemberPasswordSetupUrl,
  sendMemberInitialSetupReissueEmail,
  sendMemberPasswordResetEmail,
} from "@/lib/member-password-action-email";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

type AdminMemberPasswordResetMember = {
  id: string;
  display_name: string | null;
  email_normalized: string | null;
  must_change_password: boolean;
};

export type AdminMemberPasswordResetDelivery = "copy" | "email";
export type AdminMemberPasswordActionKind = "initial_setup" | "password_reset";

export class AdminMemberPasswordResetError extends Error {
  constructor(
    readonly code:
      | "member_not_found"
      | "email_not_available"
      | "email_transition_pending"
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
    .select("id,display_name,email_normalized,must_change_password")
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

async function createAdminPasswordAction(input: {
  memberId: string;
  mustChangePassword: boolean;
  delivery: AdminMemberPasswordResetDelivery;
  email: string | null;
}) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
  const purpose = input.mustChangePassword
    ? "manual_initial_setup"
    : "admin_password_reset";
  const { data: tokenId, error } = await getSupabaseAdminClient().rpc(
    "issue_admin_member_password_action",
    {
      p_member_id: input.memberId,
      p_purpose: purpose,
      p_delivery_channel: input.delivery === "email" ? "email" : "admin",
      // The database action locks the member and rejects delivery when the
      // address changed after this read. That prevents a newly issued link
      // from being sent to an address that was just removed or replaced.
      p_expected_email: input.delivery === "email" ? input.email : null,
      p_token_hash: hashOpaqueToken(token),
      p_expires_at: expiresAt,
    },
  );
  if (error?.message?.includes("admin_member_password_action_transition_pending")) {
    throw new AdminMemberPasswordResetError("email_transition_pending");
  }
  if (error || typeof tokenId !== "string") {
    throw new AdminMemberPasswordResetError("issue_failed");
  }

  return {
    token,
    actionKind: input.mustChangePassword
      ? "initial_setup" as const
      : "password_reset" as const,
  };
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

  const issued = await createAdminPasswordAction({
    memberId: member.id,
    mustChangePassword: member.must_change_password,
    delivery: input.delivery,
    email: member.email_normalized,
  });
  const { token } = issued;
  const resetUrl = buildMemberPasswordSetupUrl(token);

  if (input.delivery === "email") {
    try {
      const emailInput = {
        email: member.email_normalized as string,
        displayName: member.display_name ?? "회원",
        token,
      };
      if (issued.actionKind === "initial_setup") {
        await sendMemberInitialSetupReissueEmail(emailInput);
      } else {
        await sendMemberPasswordResetEmail(emailInput);
      }
    } catch {
      throw new AdminMemberPasswordResetError("email_delivery_failed");
    }
  }

  return {
    resetUrl: input.delivery === "copy" ? resetUrl : null,
    actionKind: issued.actionKind satisfies AdminMemberPasswordActionKind,
  };
}
