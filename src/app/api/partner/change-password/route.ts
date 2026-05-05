import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  changePartnerPortalPassword,
} from "@/lib/partner-auth";
import {
  delayPartnerAuthAttempt,
  getPartnerAuthAttemptScope,
  getPartnerAuthBlockingState,
  recordPartnerAuthAttempt,
} from "@/lib/partner-auth-security";
import {
  getPartnerPortalPasswordChangeErrorMessage,
  getPartnerPortalPasswordChangeErrorStatus,
  PartnerPortalPasswordChangeError,
} from "@/lib/partner-password-errors";
import { getPartnerSession, setPartnerSession } from "@/lib/partner-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  let sessionLoginId = "";
  let sessionAccountId = "";
  try {
    const session = await getPartnerSession();
    if (!session?.accountId) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_change",
        status: "failure",
        actorType: "guest",
        properties: { reason: "unauthorized" },
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    sessionLoginId = session.loginId;
    sessionAccountId = session.accountId;

    const throttleContext = {
      ipAddress: context.ipAddress ?? null,
      accountIdentifier: session.loginId,
    };
    const blockedState = await getPartnerAuthBlockingState(
      "change-password",
      throttleContext,
    );
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_change",
        status: "blocked",
        actorType: "partner",
        actorId: sessionAccountId,
        identifier: sessionLoginId,
        properties: {
          reason: "rate_limit",
          scope: getPartnerAuthAttemptScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
      await delayPartnerAuthAttempt("change-password", true);
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
        eventName: "partner_password_change",
        status: "failure",
        actorType: "partner",
        actorId: sessionAccountId,
        identifier: sessionLoginId,
        properties: { reason: "missing_fields" },
      });
      await recordPartnerAuthAttempt("change-password", throttleContext, false);
      await delayPartnerAuthAttempt("change-password");
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const result = await changePartnerPortalPassword({
      accountId: session.accountId,
      currentPassword,
      nextPassword,
    });
    const companyIds =
      result.companyIds.length > 0 ? result.companyIds : session.companyIds;

    await setPartnerSession({
      accountId: result.account.id,
      loginId: result.account.loginId,
      displayName: result.account.displayName,
      companyIds,
      mustChangePassword: result.account.mustChangePassword,
    });

    await recordPartnerAuthAttempt("change-password", throttleContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "partner_password_change",
      status: "success",
      actorType: "partner",
      actorId: result.account.id,
      identifier: result.account.loginId,
      properties: {
        accountId: result.account.id,
        companyCount: companyIds.length,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartnerPortalPasswordChangeError) {
      await logAuthSecurity({
        ...context,
        eventName: "partner_password_change",
        status: "failure",
        actorType: sessionAccountId ? "partner" : "guest",
        actorId: sessionAccountId || null,
        identifier: sessionLoginId || null,
        properties: {
          reason: error.code,
        },
      });
      await recordPartnerAuthAttempt(
        "change-password",
        {
          ipAddress: context.ipAddress ?? null,
          accountIdentifier: sessionLoginId || null,
        },
        false,
      ).catch(() => undefined);
      await delayPartnerAuthAttempt("change-password");
      return NextResponse.json(
        {
          error: error.code,
          message: getPartnerPortalPasswordChangeErrorMessage(error.code),
        },
        {
          status: getPartnerPortalPasswordChangeErrorStatus(error.code),
        },
      );
    }

    await logAuthSecurity({
      ...context,
      eventName: "partner_password_change",
      status: "failure",
      actorType: sessionAccountId ? "partner" : "guest",
      actorId: sessionAccountId || null,
      identifier: sessionLoginId || null,
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    await recordPartnerAuthAttempt(
      "change-password",
      {
        ipAddress: context.ipAddress ?? null,
        accountIdentifier: sessionLoginId || null,
      },
      false,
    ).catch(() => undefined);
    await delayPartnerAuthAttempt("change-password", true);
    return NextResponse.json(
      {
        error: "change_failed",
        message: "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
