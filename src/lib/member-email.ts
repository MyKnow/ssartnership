import { SITE_NAME, SITE_URL } from "@/lib/site";
import { sendTransactionalEmail } from "@/lib/email-delivery";
import {
  MEMBER_EMAIL_CHANGE_NOTICE_EVENT_KEY,
  MEMBER_EMAIL_CHANGE_NOTICE_SETTINGS_PATH,
  type MemberEmailChangeNotice,
} from "@/lib/member-email-change-notice";
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

/**
 * Security notice to the previously verified address after a member binds a
 * different login/recovery email. See `member-email-change-notice.ts`.
 */
export async function sendMemberEmailChangedNotice(
  notice: MemberEmailChangeNotice,
) {
  const template = await resolveNotificationTemplate(
    MEMBER_EMAIL_CHANGE_NOTICE_EVENT_KEY,
  );
  const variables = {
    siteName: SITE_NAME,
    displayName: notice.displayName,
    maskedNewEmail: notice.maskedNewEmail,
    settingsUrl: new URL(MEMBER_EMAIL_CHANGE_NOTICE_SETTINGS_PATH, SITE_URL).toString(),
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
    to: notice.to,
    subject,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}
