import { SITE_NAME } from "@/lib/site";
import { sendTransactionalEmail } from "@/lib/email-delivery";
import { MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS } from "@/lib/member-email-verification";
import { renderResolvedNotificationEmailContent } from "@/lib/notification-email-content";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";

export async function sendMemberEmailVerificationCode(input: {
  to: string;
  code: string;
}) {
  const expiresInMinutes = Math.floor(
    MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS / 60,
  );
  const template = await resolveNotificationTemplate("email.member_email_verification_code");
  const subject = renderNotificationTemplate(template.titleTemplate, {
    siteName: SITE_NAME,
  });
  const variables = {
    siteName: SITE_NAME,
    code: input.code,
    expiresInMinutes,
  };
  const renderedBody = renderResolvedNotificationEmailContent({
    eventKey: template.eventKey,
    bodyTemplate: template.bodyTemplate,
    bodyFormat: template.bodyFormat,
    isCustomized: template.isCustomized,
    variables,
  });

  await sendTransactionalEmail({
    to: input.to,
    subject,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}
