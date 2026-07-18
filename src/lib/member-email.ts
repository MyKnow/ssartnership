import { SITE_NAME } from "@/lib/site";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import { MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS } from "@/lib/member-email-verification";
import { renderEmailTemplateBody } from "@/lib/email-content";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";

export async function sendMemberEmailVerificationCode(input: {
  to: string;
  code: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const expiresInMinutes = Math.floor(
    MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS / 60,
  );
  const template = await resolveNotificationTemplate("email.member_email_verification_code");
  const subject = renderNotificationTemplate(template.titleTemplate, {
    siteName: SITE_NAME,
  });
  const renderedBody = renderEmailTemplateBody(template.bodyTemplate, template.bodyFormat, {
    siteName: SITE_NAME,
    code: input.code,
    expiresInMinutes,
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}
