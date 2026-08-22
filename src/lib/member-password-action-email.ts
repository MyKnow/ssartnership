import { sendTransactionalEmail } from "@/lib/email-delivery";
import { renderResolvedNotificationEmailContent } from "@/lib/notification-email-content";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function buildMemberPasswordSetupUrl(token: string) {
  const url = new URL("/auth/member/setup", SITE_URL);
  // Fragment values are not sent in request paths or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

async function sendMemberPasswordActionEmail(input: {
  email: string;
  displayName: string;
  token: string;
  eventKey:
    | "email.manual_member_setup_reissue"
    | "email.manual_member_password_reset";
}) {
  const template = await resolveNotificationTemplate(input.eventKey);
  const variables = {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl: buildMemberPasswordSetupUrl(input.token),
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
    to: input.email,
    subject,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}

export async function sendMemberInitialSetupReissueEmail(input: {
  email: string;
  displayName: string;
  token: string;
}) {
  return sendMemberPasswordActionEmail({
    ...input,
    eventKey: "email.manual_member_setup_reissue",
  });
}

export async function sendMemberPasswordResetEmail(input: {
  email: string;
  displayName: string;
  token: string;
}) {
  return sendMemberPasswordActionEmail({
    ...input,
    eventKey: "email.manual_member_password_reset",
  });
}
