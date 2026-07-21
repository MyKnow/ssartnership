import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearAdminSession } from "@/lib/auth";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import {
  getMemberRequiredPolicyStatus,
} from "@/lib/policy-documents";
import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { requiresMemberProfilePhotoUpdate } from "@/lib/member-profile-photo";
import { resolveActiveMemberForLogin } from "@/lib/member-authentication";
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
      eventName: "member_login",
      status: "failure",
      actorType: "guest",
      properties: { reason: "same_origin_failed" },
    });
    return NextResponse.json({ error: "login_failed" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      username?: string;
      password?: string;
      autoLogin?: boolean;
    };

    const username = normalizeMmUsername(String(payload.username ?? ""));
    const password = String(payload.password ?? "").trim();
    const autoLogin = payload.autoLogin === true;
    const throttleContext = {
      ipAddress: context.ipAddress ?? null,
      accountIdentifier: username || null,
    };
    const blockedState = await getMemberAuthBlockingState(
      "login",
      throttleContext,
    );
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "blocked",
        actorType: "guest",
        identifier: username || null,
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
      await delayMemberAuthAttempt("login", true);
      return NextResponse.json({ error: "blocked" }, { status: 429 });
    }

    if (!username || !password) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        identifier: username || null,
        properties: { reason: "missing_fields" },
      });
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 400 });
    }
    if (validateMmUsername(username)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "invalid_username" },
      });
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 400 });
    }

    const member = await resolveActiveMemberForLogin({
      kind: "mattermost_username",
      value: username,
    });

    if (!member || !member.password_hash || !member.password_salt) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "not_registered" },
      });
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }

    const ok = verifyPassword(password, member.password_salt, member.password_hash);
    if (!ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "member",
        actorId: member.id,
        identifier: username,
        properties: { reason: "invalid_credentials" },
      });
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }

    const [policyStatus, photoState] = await Promise.all([
      getMemberRequiredPolicyStatus(member.id),
      getMemberProfilePhotoState(member.id),
    ]);
    const requiresProfilePhotoUpdate = requiresMemberProfilePhotoUpdate(
      photoState.reviewStatus,
    );
    await setUserSession(member.id, Boolean(member.must_change_password), {
      persistent: autoLogin,
      authenticationMethod: "mattermost",
      freshAuthentication: true,
    });
    await clearAdminSession();
    revalidatePath("/");
    revalidatePath("/auth/consent");
    revalidatePath("/auth/change-password");
    revalidatePath("/certification");
    await recordMemberAuthAttempt("login", throttleContext, true);

    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "success",
      actorType: "member",
      actorId: member.id,
      identifier: username,
      properties: {
        mustChangePassword: Boolean(member.must_change_password),
        requiresConsent: policyStatus.requiresConsent,
        requiresProfilePhotoUpdate,
        autoLogin,
      },
    });
    return NextResponse.json({
      ok: true,
      mustChangePassword: Boolean(member.must_change_password),
      requiresConsent: policyStatus.requiresConsent,
      requiresProfilePhotoUpdate,
    });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    await delayMemberAuthAttempt("login", true);
    return NextResponse.json(
      {
        error: "login_failed",
        message: "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
