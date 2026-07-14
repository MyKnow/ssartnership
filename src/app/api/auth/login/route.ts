import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { getMemberRequiredPolicyStatus } from "@/lib/policy-documents";
import { classifyMemberLoginIdentifier } from "@/lib/member-domain";
import { hashMemberEmailIdentifier } from "@/lib/member-email-verification";
import { resolveActiveMemberForLoginWithSource } from "@/lib/member-authentication";
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
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ error: "login_failed" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      identifier?: unknown;
      password?: unknown;
      autoLogin?: unknown;
    };
    const rawIdentifier = String(payload.identifier ?? "").trim();
    const password = String(payload.password ?? "").trim();
    const autoLogin = payload.autoLogin === true;
    const loginIdentifier = classifyMemberLoginIdentifier(rawIdentifier);
    const requestedProvider = loginIdentifier?.kind === "email"
      ? "email"
      : loginIdentifier?.kind === "manual_login_id"
        ? "manual"
        : "mattermost";
    const identifier = loginIdentifier?.value ?? rawIdentifier.toLowerCase();
    const rateLimitIdentifier = loginIdentifier?.kind === "email"
      ? hashMemberEmailIdentifier(loginIdentifier.value)
      : identifier;
    const throttleContext = {
      ipAddress: context.ipAddress ?? null,
      accountIdentifier: rateLimitIdentifier || null,
    };
    const blockedState = await getMemberAuthBlockingState("login", throttleContext);
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "blocked",
        actorType: "guest",
        identifier: loginIdentifier?.kind === "email" ? null : identifier || null,
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(blockedState.identifier),
          provider: requestedProvider,
        },
      });
      await delayMemberAuthAttempt("login", true);
      return NextResponse.json({ error: "blocked" }, { status: 429 });
    }
    if (!loginIdentifier || !password) {
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 400 });
    }
    const resolvedLogin = await resolveActiveMemberForLoginWithSource(loginIdentifier);
    if (!resolvedLogin) {
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }
    const { member, authenticationMethod: provider } = resolvedLogin;
    const passwordHash = member.password_hash;
    const passwordSalt = member.password_salt;
    if (!passwordHash || !passwordSalt) {
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }
    if (!verifyPassword(password, passwordSalt, passwordHash)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "member",
        actorId: member.id,
        identifier: loginIdentifier.kind === "email" ? null : identifier,
        properties: { reason: "invalid_credentials", provider },
      });
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }

    const policyStatus = await getMemberRequiredPolicyStatus(member.id);
    await setUserSession(member.id, Boolean(member.must_change_password), {
      persistent: autoLogin,
      authenticationMethod: resolvedLogin.authenticationMethod,
      freshAuthentication: true,
    });
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
      identifier: loginIdentifier.kind === "email" ? null : identifier,
      properties: {
        mustChangePassword: Boolean(member.must_change_password),
        requiresConsent: policyStatus.requiresConsent,
        autoLogin,
        provider,
      },
    });
    return NextResponse.json({ ok: true, requiresConsent: policyStatus.requiresConsent });
  } catch {
    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "failure",
      actorType: "guest",
      properties: { reason: "exception" },
    });
    await delayMemberAuthAttempt("login", true);
    return NextResponse.json({ error: "login_failed" }, { status: 503 });
  }
}
