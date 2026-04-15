import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  delayPartnerAuthAttempt,
  getPartnerAuthAttemptScope,
  getPartnerAuthBlockingState,
  recordPartnerAuthAttempt,
} from "@/lib/partner-auth-security";
import {
  getPartnerPortalPasswordResetErrorMessage,
  getPartnerPortalPasswordResetErrorStatus,
  PartnerPortalPasswordResetError,
} from "@/lib/partner-password-errors";
import {
  requestPartnerPortalPasswordReset,
} from "@/lib/partner-auth";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { isValidEmail } from "@/lib/validation";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { sendPartnerPortalTemporaryPasswordEmail } from "@/lib/partner-email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  let normalizedEmail = "";
  try {
    const payload = (await request.json()) as { email?: string };
    const rawEmail = String(payload.email ?? "").trim();
    normalizedEmail = normalizePartnerLoginId(rawEmail);
    const throttleContext = {
      ipAddress: context.ipAddress ?? null,
      accountIdentifier: normalizedEmail || null,
    };

    const blockedState = await getPartnerAuthBlockingState(
      "reset-password",
      throttleContext,
    );
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_reset",
        status: "blocked",
        actorType: "guest",
        identifier: normalizedEmail || null,
        properties: {
          reason: "rate_limit",
          scope: getPartnerAuthAttemptScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
      await delayPartnerAuthAttempt("reset-password", true);
      return NextResponse.json({ error: "blocked" }, { status: 429 });
    }

    if (!rawEmail) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_reset",
        status: "failure",
        actorType: "guest",
        properties: { reason: "missing_fields" },
      });
      await recordPartnerAuthAttempt("reset-password", throttleContext, false);
      await delayPartnerAuthAttempt("reset-password");
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    if (!isValidEmail(rawEmail)) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_reset",
        status: "failure",
        actorType: "guest",
        identifier: normalizedEmail || null,
        properties: { reason: "invalid_email" },
      });
      await recordPartnerAuthAttempt("reset-password", throttleContext, false);
      await delayPartnerAuthAttempt("reset-password");
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const result = await requestPartnerPortalPasswordReset(normalizedEmail);

    if (!isPartnerPortalMock) {
      await sendPartnerPortalTemporaryPasswordEmail({
        to: result.emailSentTo,
        displayName: result.account.displayName,
        loginId: result.account.loginId,
        temporaryPassword: result.temporaryPassword,
      });
    }

    await recordPartnerAuthAttempt("reset-password", throttleContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "partner_password_reset",
      status: "success",
      actorType: "guest",
      identifier: result.account.loginId,
      properties: {
        accountId: result.account.id,
        emailSentTo: result.emailSentTo,
      },
    });

    return NextResponse.json({
      ok: true,
      ...(isPartnerPortalMock
        ? { temporaryPassword: result.temporaryPassword }
        : {}),
    });
  } catch (error) {
    if (error instanceof PartnerPortalPasswordResetError) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_reset",
        status: "failure",
        actorType: "guest",
        properties: {
          reason: error.code,
        },
      });
      await recordPartnerAuthAttempt(
        "reset-password",
        {
          ipAddress: context.ipAddress ?? null,
          accountIdentifier: normalizedEmail || null,
        },
        false,
      ).catch(() => undefined);
      await delayPartnerAuthAttempt("reset-password");
      return NextResponse.json(
        {
          error: error.code,
          message: getPartnerPortalPasswordResetErrorMessage(error.code),
        },
        {
          status: getPartnerPortalPasswordResetErrorStatus(error.code),
        },
      );
    }

    await logAuthSecurity({
      ...context,
      eventName: "partner_password_reset",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    await recordPartnerAuthAttempt(
      "reset-password",
      {
        ipAddress: context.ipAddress ?? null,
        accountIdentifier: normalizedEmail || null,
      },
      false,
    ).catch(() => undefined);
    await delayPartnerAuthAttempt("reset-password", true);
    return NextResponse.json(
      {
        error: "send_failed",
        message: "임시 비밀번호 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
