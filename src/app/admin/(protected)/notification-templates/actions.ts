"use server";

import { redirect } from "next/navigation";
import { logAdminAction } from "@/app/admin/(protected)/_actions/shared-helpers";
import { requireNotificationTemplateAdmin } from "@/lib/admin-access";
import {
  getNotificationTemplateDefinition,
  type NotificationTemplateBodyFormat,
  type NotificationTemplateChannel,
} from "@/lib/notification-templates/catalog";
import {
  resetNotificationTemplate,
  upsertNotificationTemplate,
} from "@/lib/notification-templates/repository.server";
import { sendNotificationTemplateTest } from "@/lib/notification-templates/test-delivery.server";

const PATH = "/admin/notification-templates";

function getChannel(value: FormDataEntryValue | null): NotificationTemplateChannel | null {
  const channel = String(value ?? "");
  if (channel === "email" || channel === "mattermost" || channel === "push" || channel === "in_app") {
    return channel;
  }
  return null;
}

function getEventKey(value: FormDataEntryValue | null) {
  const eventKey = String(value ?? "").trim();
  return eventKey && getNotificationTemplateDefinition(eventKey) ? eventKey : null;
}

function getBodyFormat(value: FormDataEntryValue | null): NotificationTemplateBodyFormat | null {
  const bodyFormat = String(value ?? "");
  if (bodyFormat === "plain" || bodyFormat === "markdown" || bodyFormat === "html") {
    return bodyFormat;
  }
  return null;
}

export async function updateNotificationTemplateAction(formData: FormData) {
  const session = await requireNotificationTemplateAdmin("update", { path: PATH });
  const eventKey = getEventKey(formData.get("eventKey"));
  const channel = getChannel(formData.get("channel"));
  const titleTemplate = String(formData.get("titleTemplate") ?? "");
  const bodyTemplate = String(formData.get("bodyTemplate") ?? "");
  const bodyFormat = getBodyFormat(formData.get("bodyFormat"));
  if (!eventKey || !channel || !bodyFormat) {
    redirect(`${PATH}?error=invalid_request`);
  }

  try {
    await upsertNotificationTemplate({
      eventKey,
      channel,
      titleTemplate,
      bodyTemplate,
      bodyFormat,
      adminId: session.adminId,
    });
  } catch {
    redirect(`${PATH}?error=save_failed`);
  }

  await logAdminAction("notification_template_update", {
    targetType: "notification_template",
    targetId: eventKey,
    properties: {
      channel,
      titleLength: titleTemplate.trim().length,
      bodyLength: bodyTemplate.trim().length,
    },
  });
  redirect(`${PATH}?status=updated`);
}

export async function resetNotificationTemplateAction(formData: FormData) {
  await requireNotificationTemplateAdmin("delete", { path: PATH });
  const eventKey = getEventKey(formData.get("eventKey"));
  const channel = getChannel(formData.get("channel"));
  if (!eventKey || !channel) {
    redirect(`${PATH}?error=invalid_request`);
  }
  try {
    await resetNotificationTemplate({ eventKey, channel });
  } catch {
    redirect(`${PATH}?error=reset_failed`);
  }

  await logAdminAction("notification_template_reset", {
    targetType: "notification_template",
    targetId: eventKey,
    properties: { channel },
  });
  redirect(`${PATH}?status=reset`);
}

function getMemberId(value: FormDataEntryValue | null) {
  const memberId = String(value ?? "").trim();
  return memberId || null;
}

export async function sendNotificationTemplateTestAction(formData: FormData) {
  await requireNotificationTemplateAdmin("update", { path: PATH });
  const eventKey = getEventKey(formData.get("eventKey"));
  const channel = getChannel(formData.get("channel"));
  const memberId = getMemberId(formData.get("memberId"));
  const titleTemplate = String(formData.get("titleTemplate") ?? "");
  const bodyTemplate = String(formData.get("bodyTemplate") ?? "");
  const bodyFormat = getBodyFormat(formData.get("bodyFormat"));
  if (!eventKey || !channel || !memberId || !bodyFormat) {
    redirect(`${PATH}?error=invalid_request`);
  }

  try {
    await sendNotificationTemplateTest({
      memberId,
      eventKey,
      channel,
      titleTemplate,
      bodyTemplate,
      bodyFormat,
    });
  } catch {
    redirect(`${PATH}?error=test_failed`);
  }

  await logAdminAction("notification_template_test_send", {
    targetType: "notification_template",
    targetId: eventKey,
    properties: {
      channel,
      recipientMemberId: memberId,
      titleLength: titleTemplate.trim().length,
      bodyLength: bodyTemplate.trim().length,
    },
  });
  redirect(`${PATH}?status=test-sent`);
}
