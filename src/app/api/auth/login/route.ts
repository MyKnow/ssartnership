import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearAdminSession } from "@/lib/auth";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { getMemberRequiredPolicyStatus } from "@/lib/policy-documents";
import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { requiresMemberProfilePhotoUpdate } from "@/lib/member-profile-photo";
import { classifyMemberLoginIdentifier } from "@/lib/member-domain";
import { hashMemberEmailIdentifier } from "@/lib/member-email-verification";
import {
  resolveActiveMemberForLoginWithSource,
  type LoginMemberResolution,
} from "@/lib/member-authentication";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  getMockMemberById,
  isMockMemberAuthEnabled,
  MOCK_MEMBER_ID,
  verifyMockMemberCredentials,
} from "@/lib/mock/member";

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
    const mockAuthEnabled = isMockMemberAuthEnabled();
    let resolvedLogin: LoginMemberResolution | null;
    if (mockAuthEnabled) {
      if (!loginIdentifier || !password) {
        return NextResponse.json({ error: "login_failed" }, { status: 400 });
      }
      if (!verifyMockMemberCredentials(identifier, password)) {
        return NextResponse.json({ error: "login_failed" }, { status: 401 });
      }
      const mockMember = getMockMemberById(MOCK_MEMBER_ID);
      if (!mockMember) {
        return NextResponse.json({ error: "login_failed" }, { status: 503 });
      }
      resolvedLogin = {
        member: {
          id: mockMember.id,
          password_hash: null,
          password_salt: null,
          must_change_password: mockMember.mustChangePassword,
        },
        authenticationMethod: "manual",
      };
    } else {
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
      resolvedLogin = await resolveActiveMemberForLoginWithSource(loginIdentifier);
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
    }

    if (!resolvedLogin) {
      return NextResponse.json({ error: "login_failed" }, { status: 503 });
    }
    const { member, authenticationMethod: provider } = resolvedLogin;

    const [policyStatus, photoState] = await Promise.all([
      getMemberRequiredPolicyStatus(member.id),
      getMemberProfilePhotoState(member.id),
    ]);
    const requiresProfilePhotoUpdate = requiresMemberProfilePhotoUpdate(
      photoState.reviewStatus,
    );
    await setUserSession(member.id, Boolean(member.must_change_password), {
      persistent: autoLogin,
      authenticationMethod: resolvedLogin.authenticationMethod,
      freshAuthentication: true,
    });
    await clearAdminSession();
    revalidatePath("/");
    revalidatePath("/auth/consent");
    revalidatePath("/auth/change-password");
    revalidatePath("/certification");
    if (!mockAuthEnabled) {
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
          requiresProfilePhotoUpdate,
          autoLogin,
          provider,
        },
      });
    }
    return NextResponse.json({
      ok: true,
      mustChangePassword: Boolean(member.must_change_password),
      requiresConsent: policyStatus.requiresConsent,
      requiresProfilePhotoUpdate,
    });
  } catch {
    if (!isMockMemberAuthEnabled()) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        properties: { reason: "exception" },
      });
      await delayMemberAuthAttempt("login", true);
    }
    return NextResponse.json({ error: "login_failed" }, { status: 503 });
  }
}
