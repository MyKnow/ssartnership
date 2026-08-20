import { renderEmailTemplateBody } from "@/lib/email-content";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";

export function buildMemberPasswordSetupUrl(token: string) {
  const url = new URL("/auth/member/setup", SITE_URL);
  // Fragment values are not sent in request paths or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function sendMemberPasswordResetEmail(input: {
  email: string;
  displayName: string;
  token: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transport = createSmtpTransport(smtpConfig);
  const template = await resolveNotificationTemplate(
    "email.manual_member_password_reset",
  );
  const variables = {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl: buildMemberPasswordSetupUrl(input.token),
  };
  const subject = renderNotificationTemplate(template.titleTemplate, variables);
  const renderedBody = renderEmailTemplateBody(
    template.bodyTemplate,
    template.bodyFormat,
    variables,
  );
  await transport.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.email,
    subject,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}
