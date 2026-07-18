import { SITE_NAME } from "./site";
import { createSmtpTransport, getSmtpConfig } from "./smtp";
import type { PartnerOperationalNotificationType } from "./partner-notification-routing";
import {
  renderEmailTemplateBody,
} from "@/lib/email-content";
import { getPartnerOperationalTemplateKey } from "./notification-templates/catalog";
import { resolveNotificationTemplate } from "./notification-templates/repository.server";
import { renderNotificationTemplate } from "./notification-templates/template";
import {
  mergeNotificationTemplateVariables,
  type NotificationTemplateContext,
} from "./notification-templates/context";

async function renderPartnerEmailTemplate(
  eventKey: string,
  variables: Record<string, string | number | null | undefined>,
) {
  const template = await resolveNotificationTemplate(eventKey);
  const renderedBody = renderEmailTemplateBody(
    template.bodyTemplate,
    template.bodyFormat,
    variables,
  );
  return {
    subject: renderNotificationTemplate(template.titleTemplate, variables),
    ...renderedBody,
  };
}

export async function sendPartnerPortalTemporaryPasswordEmail(input: {
  to: string;
  displayName: string;
  loginId: string;
  temporaryPassword: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const template = await renderPartnerEmailTemplate("email.partner_temporary_password", {
    siteName: SITE_NAME,
    displayName: input.displayName || "담당자",
    loginId: input.loginId,
    temporaryPassword: input.temporaryPassword,
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendPartnerPortalInitialSetupEmail(input: {
  to: string;
  displayName: string;
  loginId: string;
  setupUrl: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const template = await renderPartnerEmailTemplate("email.partner_initial_setup", {
    siteName: SITE_NAME,
    displayName: input.displayName || "담당자",
    loginId: input.loginId,
    setupUrl: input.setupUrl,
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendPartnerOperationalNotificationEmail(input: {
  to: string;
  displayName: string;
  title: string;
  body: string;
  targetUrl: string;
  notificationType?: PartnerOperationalNotificationType;
  templateContext?: NotificationTemplateContext;
  templateVariant?: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const eventKey = input.notificationType
    ? getPartnerOperationalTemplateKey(
        "email",
        input.notificationType,
        input.templateVariant,
      )
    : "email.partner_operational";
  const template = await renderPartnerEmailTemplate(eventKey, {
    ...mergeNotificationTemplateVariables({
      context: input.templateContext,
      common: {
        siteName: SITE_NAME,
        displayName: input.displayName || "담당자",
        title: input.title,
        body: input.body,
        targetUrl: input.targetUrl,
      },
    }),
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
