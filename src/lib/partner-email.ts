import { SITE_NAME } from "./site";
import { sendTransactionalEmail } from "./email-delivery";
import type { PartnerOperationalNotificationType } from "./partner-notification-routing";
import { renderResolvedNotificationEmailContent } from "@/lib/notification-email-content";
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
  const renderedBody = renderResolvedNotificationEmailContent({
    eventKey: template.eventKey,
    bodyTemplate: template.bodyTemplate,
    bodyFormat: template.bodyFormat,
    isCustomized: template.isCustomized,
    variables,
  });
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
  const template = await renderPartnerEmailTemplate("email.partner_temporary_password", {
    siteName: SITE_NAME,
    displayName: input.displayName || "담당자",
    loginId: input.loginId,
    temporaryPassword: input.temporaryPassword,
  });

  await sendTransactionalEmail({
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
  const template = await renderPartnerEmailTemplate("email.partner_initial_setup", {
    siteName: SITE_NAME,
    displayName: input.displayName || "담당자",
    loginId: input.loginId,
    setupUrl: input.setupUrl,
  });

  await sendTransactionalEmail({
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

  await sendTransactionalEmail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
