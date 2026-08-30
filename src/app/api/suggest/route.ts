import { NextResponse } from "next/server";
import {
  getRequestLogContext,
  scheduleProductEventLog,
  resolveCurrentActor,
} from "@/lib/activity-logs";
import { BUG_REPORT_EMAIL, SITE_NAME } from "@/lib/site";
import {
  getEmailDeliveryConfig,
  sendTransactionalEmail,
  toEmailDeliveryConfigErrorLog,
} from "@/lib/email-delivery";
import { renderResolvedNotificationEmailContent } from "@/lib/notification-email-content";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { isBlocked, recordAttempt, SUGGEST_RATE_LIMIT } from "@/lib/rate-limit";
import { validateSuggestPayload } from "@/lib/suggest-validation";
import {
  JsonRequestBodyError,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_SUGGEST_JSON_BODY_BYTES = 16 * 1024;

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function getClientIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  try {
    const identifier = getClientIdentifier(request);
    if (await isBlocked(identifier, SUGGEST_RATE_LIMIT)) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    let rawPayload: Parameters<typeof validateSuggestPayload>[0];
    try {
      rawPayload = await readJsonRequestBodyWithinLimit<
        Parameters<typeof validateSuggestPayload>[0]
      >(request, MAX_SUGGEST_JSON_BODY_BYTES);
    } catch (error) {
      if (!(error instanceof JsonRequestBodyError)) {
        throw error;
      }
      await recordAttempt(identifier, false, SUGGEST_RATE_LIMIT);
      return errorResponse(
        error.message,
        error.code === "body_too_large" ? 413 : 400,
        "suggest_invalid_body",
      );
    }
    const validation = validateSuggestPayload(rawPayload);
    if (!validation.ok) {
      return errorResponse(validation.message, 400, validation.code);
    }
    const payload = validation.values;
    const safeCompanyUrlValue = validation.safeCompanyUrl;

    await recordAttempt(identifier, false, SUGGEST_RATE_LIMIT);

    const recipient = process.env.SUGGEST_NOTIFY_EMAIL ?? BUG_REPORT_EMAIL;
    try {
      getEmailDeliveryConfig();
    } catch (error) {
      console.error(
        "[suggest] email config error",
        toEmailDeliveryConfigErrorLog(error),
      );
      return errorResponse(
        "메일 설정이 누락되었습니다.",
        503,
        "suggest_mail_not_configured",
      );
    }

    const template = await resolveNotificationTemplate(
      "email.partner_suggestion_received",
    );
    const variables = {
      siteName: SITE_NAME,
      contactName: payload.contactName ?? "담당자",
      contactRole: payload.contactRole ?? "",
      companyName: payload.companyName ?? "",
      businessArea: payload.businessArea ?? "",
      partnershipConditions: payload.partnershipConditions ?? "",
      contactEmail: payload.contactEmail ?? "",
      companyUrl: safeCompanyUrlValue ?? "-",
    };
    const subject = renderNotificationTemplate(template.titleTemplate, variables);
    const renderedBody = renderResolvedNotificationEmailContent({
      eventKey: template.eventKey,
      bodyTemplate: template.bodyTemplate,
      bodyFormat: template.bodyFormat,
      isCustomized: template.isCustomized,
      variables,
    });

    await sendTransactionalEmail({
      to: payload.contactEmail,
      bcc: recipient,
      replyTo: payload.contactEmail,
      subject,
      text: renderedBody.text,
      html: renderedBody.html,
    });

    const actor = await resolveCurrentActor();
    scheduleProductEventLog({
      ...context,
      eventName: "suggest_submit",
      actorType: actor.actorType,
      actorId: actor.actorId,
      targetType: "suggestion",
      properties: {
        companyName: payload.companyName?.trim() ?? "",
        hasCompanyUrl: Boolean(safeCompanyUrlValue),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("suggest email error", error);
    return errorResponse(
      "메일 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      503,
      "suggest_mail_send_failed",
    );
  }
}
