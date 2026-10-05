import "server-only";

import { after } from "next/server";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";
import { sendMemberEmailChangedNotice } from "@/lib/member-email";
import {
  resolveMemberEmailChangeNotice,
  type PreviousMemberEmailState,
} from "@/lib/member-email-change-notice";
import { logMemberEmailSecurity } from "@/lib/member-email-security-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type MemberEmailChangeNoticeLogContext = Parameters<
  typeof logMemberEmailSecurity
>[0]["context"];

/**
 * Reads the member's current email state before a binding completes. A read
 * failure only skips the notice; it never blocks the binding itself.
 */
export async function readPreviousMemberEmailState(
  memberId: string,
): Promise<PreviousMemberEmailState | null> {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("members")
      .select("email_normalized,email_verified_at,display_name")
      .eq("id", memberId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    return {
      emailNormalized: data.email_normalized ?? null,
      emailVerifiedAt: data.email_verified_at ?? null,
      displayName: data.display_name ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Sends the change notice to the previously verified address after the
 * response, so mail delivery latency or failure never changes the binding
 * result. Delivery failures are recorded as a security log.
 */
export function scheduleMemberEmailChangeNotice(input: {
  previous: PreviousMemberEmailState | null;
  nextEmailNormalized: string;
  memberId: string;
  flow: "verification" | "recovery";
  context: MemberEmailChangeNoticeLogContext;
}) {
  const notice = resolveMemberEmailChangeNotice(
    input.previous,
    input.nextEmailNormalized,
  );
  if (!notice || isE2eMockMutationEnabled()) {
    return;
  }
  const deliver = async () => {
    let delivered = false;
    try {
      await sendMemberEmailChangedNotice(notice);
      delivered = true;
    } catch {
      delivered = false;
    }
    await logMemberEmailSecurity({
      context: input.context,
      flow: input.flow,
      stage: "change_notice",
      status: delivered ? "success" : "failure",
      actorId: input.memberId,
      ...(delivered ? {} : { reason: "notice_delivery_failed" }),
    }).catch(() => undefined);
  };
  try {
    after(deliver);
  } catch {
    // Outside a request scope `after` is unavailable; the binding already
    // succeeded, so deliver in the background instead of failing the caller.
    void deliver();
  }
}
