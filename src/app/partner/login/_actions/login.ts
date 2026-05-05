"use server";

import { redirect } from "next/navigation";
import { getServerActionLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  authenticatePartnerPortalLogin,
  PartnerPortalLoginError,
} from "@/lib/partner-auth";
import {
  delayPartnerAuthAttempt,
  getPartnerAuthAttemptScope,
  getPartnerAuthBlockingState,
  recordPartnerAuthAttempt,
} from "@/lib/partner-auth-security";
import { setPartnerSession } from "@/lib/partner-session";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import { buildPartnerLoginErrorRedirect } from "./shared";

function createThrottleContext(loginId: string) {
  return {
    ipAddress: null as string | null,
    accountIdentifier: loginId || null,
  };
}

async function redirectPartnerLoginFailure({
  context,
  throttleContext,
  loginId,
  errorCode,
  reason,
  blockedDelay = false,
  recordFailure = true,
  extraProperties,
}: {
  context: Awaited<ReturnType<typeof getServerActionLogContext>>;
  throttleContext: ReturnType<typeof createThrottleContext>;
  loginId: string;
  errorCode: string;
  reason: string;
  blockedDelay?: boolean;
  recordFailure?: boolean;
  extraProperties?: Record<string, unknown>;
}) {
  await logAuthSecurity({
    ...context,
    eventName: "partner_login",
    status: blockedDelay ? "blocked" : "failure",
    actorType: "guest",
    identifier: loginId || null,
    properties: {
      reason,
      ...(extraProperties ?? {}),
    },
  });

  if (recordFailure) {
    await recordPartnerAuthAttempt("login", throttleContext, blockedDelay).catch(
      () => undefined,
    );
  }

  await delayPartnerAuthAttempt("login", blockedDelay);
  redirect(buildPartnerLoginErrorRedirect(errorCode, loginId));
}

export async function loginAction(formData: FormData) {
  const context = await getServerActionLogContext("/partner/login");
  const rawLoginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const loginId = normalizePartnerLoginId(rawLoginId);
  const throttleContext = {
    ...createThrottleContext(loginId),
    ipAddress: context.ipAddress ?? null,
  };

  const blockedState = await getPartnerAuthBlockingState("login", throttleContext);
  if (blockedState) {
    return redirectPartnerLoginFailure({
      context,
      throttleContext,
      loginId,
      errorCode: "blocked",
      reason: "rate_limit",
      blockedDelay: true,
      recordFailure: false,
      extraProperties: {
        scope: getPartnerAuthAttemptScope(blockedState.identifier),
        blockedUntil: blockedState.blockedUntil,
      },
    });
  }

  if (!rawLoginId || !password) {
    return redirectPartnerLoginFailure({
      context,
      throttleContext,
      loginId,
      errorCode: "invalid_request",
      reason: "missing_fields",
    });
  }

  if (!isValidEmail(rawLoginId)) {
    return redirectPartnerLoginFailure({
      context,
      throttleContext,
      loginId,
      errorCode: "invalid_email",
      reason: "invalid_email",
    });
  }

  let successRedirectPath = "/partner";
  try {
    const result = await authenticatePartnerPortalLogin(loginId, password);
    await setPartnerSession({
      accountId: result.account.id,
      loginId: result.account.loginId,
      displayName: result.account.displayName,
      companyIds: result.companyIds,
      mustChangePassword: result.account.mustChangePassword,
    });
    await recordPartnerAuthAttempt("login", throttleContext, true).catch(
      () => undefined,
    );

    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "success",
      actorType: "partner",
      actorId: result.account.id,
      identifier: result.account.loginId,
      properties: {
        accountId: result.account.id,
        companyCount: result.companyIds.length,
      },
    });

    successRedirectPath = result.account.mustChangePassword
      ? "/partner/change-password"
      : "/partner";
  } catch (error) {
    if (error instanceof PartnerPortalLoginError) {
      return redirectPartnerLoginFailure({
        context,
        throttleContext,
        loginId,
        errorCode: "invalid_credentials",
        reason: error.code,
      });
    }

    await logAuthSecurity({
      ...context,
      eventName: "partner_login",
      status: "failure",
      actorType: "guest",
      identifier: loginId || null,
      properties: {
        reason: "exception",
        message: error instanceof Error ? error.message : "unknown_error",
      },
    });
    await recordPartnerAuthAttempt("login", throttleContext, false).catch(
      () => undefined,
    );
    await delayPartnerAuthAttempt("login", true);
    redirect(buildPartnerLoginErrorRedirect("server_error", loginId));
  }

  redirect(successRedirectPath);
}
