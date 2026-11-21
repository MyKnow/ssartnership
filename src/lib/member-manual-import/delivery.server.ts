import { SITE_NAME } from "@/lib/site";
import { renderResolvedNotificationEmailContent } from "@/lib/notification-email-content";
import { getEmailDeliveryConfig, sendTransactionalEmail } from "@/lib/email-delivery";
import { buildMemberPasswordSetupUrl } from "@/lib/member-password-action-email";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { ensureManualMemberImportPasswordAction } from "./password-actions.server";
import {
  checkpointManualMemberImportDeliveryIntent,
  checkpointManualMemberImportDeliveryAttempt,
  checkpointManualMemberImportDeliverySent,
} from "./repository.supabase";
import { ManualMemberImportDeliveryOutcomeUnknownError } from "./errors";
import type { ImportRow, ResolvedMattermostMember } from "./types";

export async function buildManualMemberSetupMattermostMessage(input: {
  displayName: string;
  setupUrl: string;
}) {
  const template = await resolveNotificationTemplate("mattermost.manual_member_setup");
  const variables = {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl: input.setupUrl,
  };
  return [
    renderNotificationTemplate(template.titleTemplate, variables),
    renderNotificationTemplate(template.bodyTemplate, variables),
  ].join("\n\n");
}

export async function sendSetupEmail(input: {
  email: string;
  displayName: string;
  token: string;
  reset: boolean;
  idempotencyKey?: string;
}) {
  const setupUrl = buildMemberPasswordSetupUrl(input.token);
  const template = await resolveNotificationTemplate(
    input.reset
      ? "email.manual_member_password_reset"
      : "email.manual_member_setup",
  );
  const variables = {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl,
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
    idempotencyKey: input.idempotencyKey,
    // Message-ID remains SMTP correlation metadata. The Resend provider uses
    // the same durable key as its 24-hour Idempotency-Key.
    messageId: input.idempotencyKey
      ? getManualMemberImportEmailMessageId(input.idempotencyKey)
      : undefined,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}

function getManualMemberImportDeliveryIdempotencyKey(rowId: string) {
  return `manual-member-import-setup:${rowId}`;
}

function getManualMemberImportEmailMessageId(idempotencyKey: string) {
  if (!/^manual-member-import-(?:setup:[0-9a-f-]{36}|reissue:[0-9a-f-]{36}:[0-9a-f-]{36})$/.test(idempotencyKey)) {
    throw new Error("수동 회원 가져오기 이메일 키를 확인하지 못했습니다.");
  }
  return `<${idempotencyKey.replace(":", "-")}@ssartnership.local>`;
}

type ManualMemberImportDelivery = {
  deliveryChannel: "mattermost" | "email";
  rowLeaseVersion: string;
};

export async function deliverManualMemberImportSetup(input: {
  row: ImportRow;
  memberId: string;
  displayName: string;
  resolvedMattermostMember: ResolvedMattermostMember | null;
  rowLeaseVersion: string;
  onRowLeaseUpdated: (rowLeaseVersion: string) => void;
}): Promise<ManualMemberImportDelivery> {
  let deliveryChannel = input.row.delivery_channel;
  const deliveryIdempotencyKey = input.row.delivery_idempotency_key
    ?? getManualMemberImportDeliveryIdempotencyKey(input.row.id);
  let currentRowLeaseVersion = input.rowLeaseVersion;

  async function checkpointDeliverySent(channel: "mattermost" | "email") {
    try {
      const sent = await checkpointManualMemberImportDeliverySent({
        row: input.row,
        rowLeaseVersion: currentRowLeaseVersion,
        deliveryChannel: channel,
        deliveryIdempotencyKey,
      });
      currentRowLeaseVersion = sent.rowLeaseVersion;
      input.onRowLeaseUpdated(currentRowLeaseVersion);
      return { deliveryChannel: channel, rowLeaseVersion: currentRowLeaseVersion };
    } catch {
      // The provider may already have accepted the message; do not reopen a
      // retry path unless a later provider status lookup can prove otherwise.
      throw new ManualMemberImportDeliveryOutcomeUnknownError();
    }
  }

  if (input.row.delivery_sent_at) {
    if (!deliveryChannel || !input.row.delivery_idempotency_key) {
      throw new Error("설정 링크 전송 체크포인트를 확인하지 못했습니다.");
    }
    return { deliveryChannel, rowLeaseVersion: currentRowLeaseVersion };
  }

  const initialDeliveryChannel = deliveryChannel
    ?? (input.resolvedMattermostMember ? "mattermost" : "email");
  if (
    deliveryChannel !== initialDeliveryChannel
    || input.row.delivery_idempotency_key !== deliveryIdempotencyKey
  ) {
    const intent = await checkpointManualMemberImportDeliveryIntent({
      row: input.row,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel: initialDeliveryChannel,
      deliveryIdempotencyKey,
    });
    deliveryChannel = initialDeliveryChannel;
    currentRowLeaseVersion = intent.rowLeaseVersion;
    input.onRowLeaseUpdated(currentRowLeaseVersion);
  }

  if (deliveryChannel !== "mattermost" && deliveryChannel !== "email") {
    throw new Error("계정 설정 링크를 전달할 수 없습니다.");
  }

  if (input.row.delivery_attempted_at) {
    // Mattermost direct posts and SMTP do not expose a durable provider-side
    // idempotency/status lookup. A retry could send a second setup link.
    throw new ManualMemberImportDeliveryOutcomeUnknownError();
  }

  if (deliveryChannel === "mattermost") {
    const recipient = input.resolvedMattermostMember;
    if (!recipient) {
      throw new Error("MM 계정 설정 알림 대상을 확인하지 못했습니다.");
    }
    const setupToken = await ensureManualMemberImportPasswordAction({
      memberId: input.memberId,
      rowId: input.row.id,
      deliveryChannel,
    });
    const attempted = await checkpointManualMemberImportDeliveryAttempt({
      row: input.row,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel,
      deliveryIdempotencyKey,
    });
    currentRowLeaseVersion = attempted.rowLeaseVersion;
    input.onRowLeaseUpdated(currentRowLeaseVersion);

    try {
      const setupUrl = buildMemberPasswordSetupUrl(setupToken);
      const message = await buildManualMemberSetupMattermostMessage({
        displayName: input.displayName,
        setupUrl,
      });
      await withActiveMattermostSenderForGeneration(
        recipient.resolvedGeneration,
        (session) => session.sendDirectMessage(
          recipient.mattermostUserId,
          message,
        ),
      );
    } catch {
      throw new ManualMemberImportDeliveryOutcomeUnknownError();
    }
    return checkpointDeliverySent("mattermost");
  }

  if (!input.row.email_normalized) {
    throw new Error("계정 설정 링크를 전달할 수 없습니다.");
  }
  // Validate static configuration before recording an attempt. Any later
  // provider error is intentionally treated as an unknown outcome and is not resent.
  getEmailDeliveryConfig();
  const setupToken = await ensureManualMemberImportPasswordAction({
    memberId: input.memberId,
    rowId: input.row.id,
    deliveryChannel,
  });
  const attempted = await checkpointManualMemberImportDeliveryAttempt({
    row: input.row,
    rowLeaseVersion: currentRowLeaseVersion,
    deliveryChannel,
    deliveryIdempotencyKey,
  });
  currentRowLeaseVersion = attempted.rowLeaseVersion;
  input.onRowLeaseUpdated(currentRowLeaseVersion);
  try {
    await sendSetupEmail({
      email: input.row.email_normalized,
      displayName: input.displayName,
      token: setupToken,
      reset: false,
      idempotencyKey: deliveryIdempotencyKey,
    });
  } catch {
    throw new ManualMemberImportDeliveryOutcomeUnknownError();
  }
  return checkpointDeliverySent("email");
}
