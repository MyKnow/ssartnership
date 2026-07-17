import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
  getSelectedPolicyValidationError,
  recordMarketingPolicyConsent,
  recordRequiredPolicyConsent,
} from "@/lib/policy-documents";
import { hashPassword } from "@/lib/password";
import { getMattermostDisplayName } from "@/lib/mm-member-sync/snapshot";
import { getMattermostCodeSession, clearMattermostCodeSession } from "@/lib/mattermost-code-session";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { findMmUserDirectoryEntryByUserId, upsertMmUserDirectorySnapshot } from "@/lib/mm-directory";
import { hasReservedMemberIdentifier } from "@/lib/member-identifier-reservations";
import { isMattermostLoginDisabledForGeneration } from "@/lib/member-email-login-transition";
import { parseMemberSignupCompleteInput } from "@/lib/member-signup";
import { sanitizeReturnTo } from "@/lib/return-to";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession, UserSessionIssueError } from "@/lib/user-auth";

export const runtime = "nodejs";

function errorResponse(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return errorResponse("forbidden", 403);
  }
  const verification = await getMattermostCodeSession("signup");
  if (!verification) {
    return errorResponse("verification_expired", 401);
  }
  const body = await request.json().catch(() => null);
  const parsed = parseMemberSignupCompleteInput(body);
  if (!parsed.ok) {
    return errorResponse("invalid_request", 400, { fieldErrors: parsed.fieldErrors });
  }

  const [activePolicies, marketingPolicy] = await Promise.all([
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing"),
  ]);
  const policyError = getSelectedPolicyValidationError(
    parsed.data,
    activePolicies,
    marketingPolicy,
  );
  if (policyError) {
    return errorResponse("policy_outdated", 409, { message: policyError });
  }

  try {
    const user = await withActiveMattermostSenderForGeneration(
      verification.senderGeneration,
      (session) => session.getUserById(verification.mmUserId),
    );
    if (user.id !== verification.mmUserId || user.deleteAt > 0) {
      await clearMattermostCodeSession();
      return errorResponse("verification_expired", 401);
    }
    if (
      verification.subjectGeneration > 0
      && await isMattermostLoginDisabledForGeneration(verification.subjectGeneration)
    ) {
      await clearMattermostCodeSession();
      return errorResponse("generation_completed", 409);
    }

    const isStaff = verification.subjectGeneration === 0;
    const sourceYears = [
      isStaff ? verification.senderGeneration : verification.subjectGeneration,
    ];
    await upsertMmUserDirectorySnapshot({
      mmUserId: user.id,
      mmUsername: user.username,
      displayName: getMattermostDisplayName(user),
      campus: null,
      isStaff,
      sourceYears,
    });
    const directory = await findMmUserDirectoryEntryByUserId(user.id);
    if (!directory?.id) {
      throw new Error("directory_missing");
    }

    if (await hasReservedMemberIdentifier({ mmUserId: user.id, mmUsername: user.username })) {
      await clearMattermostCodeSession();
      return errorResponse("already_registered", 409, { redirectTo: "/auth/login" });
    }

    const supabase = getSupabaseAdminClient();
    const { data: duplicate, error: duplicateError } = await supabase
      .from("members")
      .select("id")
      .eq("mattermost_account_id", directory.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate?.id) {
      await clearMattermostCodeSession();
      return errorResponse("already_registered", 409, { redirectTo: "/auth/login" });
    }

    const now = new Date().toISOString();
    const password = hashPassword(parsed.data.password);
    const { data: inserted, error: insertError } = await supabase
      .from("members")
      .insert({
        mattermost_account_id: directory.id,
        display_name: getMattermostDisplayName(user),
        generation: verification.subjectGeneration,
        staff_source_generation: isStaff ? verification.senderGeneration : null,
        campus: null,
        password_hash: password.hash,
        password_salt: password.salt,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insertError || !inserted?.id) throw insertError ?? new Error("member_insert_failed");

    try {
      await recordRequiredPolicyConsent({
        memberId: inserted.id,
        activePolicies,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
      await recordMarketingPolicyConsent({
        memberId: inserted.id,
        activePolicy: marketingPolicy,
        agreed: parsed.data.marketingPolicyChecked,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
      await setUserSession(inserted.id, false, {
        authenticationMethod: "mattermost",
        freshAuthentication: true,
      });
    } catch (error) {
      await supabase.from("members").delete().eq("id", inserted.id);
      throw error;
    }

    await clearMattermostCodeSession();
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "success",
      actorType: "member",
      actorId: inserted.id,
      properties: { source: "mattermost_code", generation: verification.subjectGeneration },
    });
    revalidatePath("/");
    return NextResponse.json({ ok: true, redirectTo: sanitizeReturnTo(
      typeof body === "object" && body && !Array.isArray(body)
        ? (body as Record<string, unknown>).returnTo as string | undefined
        : undefined,
      "/",
    ) });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "failure",
      actorType: "guest",
      properties: {
        source: "mattermost_code",
        reason: error instanceof UserSessionIssueError ? error.code : "signup_failed",
      },
    });
    return errorResponse("signup_failed", 503);
  }
}
