import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession, setUserSession } from "@/lib/user-auth";
import { hashPassword, isValidPassword, verifyPassword } from "@/lib/password";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    await logAuthSecurity({
      ...context,
      eventName: "member_password_change",
      status: "failure",
      actorType: "guest",
      properties: { reason: "same_origin_failed" },
    });
    return NextResponse.json({ error: "change_failed" }, { status: 403 });
  }

  try {
    const session = await getSignedUserSession();
    if (!session?.userId) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "failure",
        actorType: "guest",
        properties: { reason: "unauthorized" },
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const throttleContext = {
      ipAddress: context.ipAddress ?? null,
      accountIdentifier: session.userId,
    };
    const blockedState = await getMemberAuthBlockingState(
      "change-password",
      throttleContext,
    );
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "blocked",
        actorType: "member",
        actorId: session.userId,
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
      await delayMemberAuthAttempt("change-password", true);
      return NextResponse.json({ error: "blocked" }, { status: 429 });
    }
    const payload = (await request.json()) as {
      currentPassword?: string;
      nextPassword?: string;
    };
    const currentPassword = String(payload.currentPassword ?? "").trim();
    const nextPassword = String(payload.nextPassword ?? "").trim();
    if (!currentPassword || !nextPassword) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { reason: "missing_fields" },
      });
      await recordMemberAuthAttempt("change-password", throttleContext, false);
      await delayMemberAuthAttempt("change-password");
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (!isValidPassword(nextPassword)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { reason: "invalid_password" },
      });
      await recordMemberAuthAttempt("change-password", throttleContext, false);
      await delayMemberAuthAttempt("change-password");
      return NextResponse.json({ error: "invalid_password" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: member } = await supabase
      .from("members")
      .select("id,password_hash,password_salt,mattermost_account_id,updated_at")
      .eq("id", session.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!member?.password_hash || !member.password_salt) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { reason: "wrong_password" },
      });
      await recordMemberAuthAttempt("change-password", throttleContext, false);
      await delayMemberAuthAttempt("change-password");
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }

    const ok = verifyPassword(
      currentPassword,
      member.password_salt,
      member.password_hash,
    );
    if (!ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { reason: "wrong_password" },
      });
      await recordMemberAuthAttempt("change-password", throttleContext, false);
      await delayMemberAuthAttempt("change-password");
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }

    const record = hashPassword(nextPassword);
    const usesMattermostAuthentication =
      session.authenticationMethod === "mattermost"
      || session.authenticationMethod === "ssafy";
    const { data: updatedMemberId, error: updateError } = usesMattermostAuthentication
      ? await supabase.rpc(
        "update_member_mattermost_password_credentials",
        {
          p_member_id: session.userId,
          p_expected_mattermost_account_id: member.mattermost_account_id,
          p_expected_updated_at: member.updated_at,
          p_password_hash: record.hash,
          p_password_salt: record.salt,
        },
      )
      : await supabase.rpc(
        "update_member_password_credentials",
        {
          p_member_id: session.userId,
          p_password_hash: record.hash,
          p_password_salt: record.salt,
        },
      );
    if (updateError || updatedMemberId !== session.userId) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_change",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: {
          reason: "state_update_failed",
          message: updateError?.message ?? "update_failed",
        },
      });
      await recordMemberAuthAttempt("change-password", throttleContext, false);
      await delayMemberAuthAttempt("change-password", true);
      return NextResponse.json(
        {
          error: "change_failed",
          message: "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 503 },
      );
    }

    await setUserSession(session.userId, false, {
      freshAuthentication: true,
    });
    revalidatePath("/auth/change-password");
    revalidatePath("/auth/consent");
    revalidatePath("/certification");
    revalidatePath("/");
    await recordMemberAuthAttempt("change-password", throttleContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "member_password_change",
      status: "success",
      actorType: "member",
      actorId: session.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_password_change",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    await delayMemberAuthAttempt("change-password", true);
    return NextResponse.json(
      {
        error: "change_failed",
        message: "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
