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

function getChannel(value: FormDataEntryValue | null): NotificationTemplateChannel {
  const channel = String(value ?? "");
  if (channel === "email" || channel === "mattermost" || channel === "push" || channel === "in_app") {
    return channel;
  }
  throw new Error("알림 채널을 확인해 주세요.");
}

function getEventKey(value: FormDataEntryValue | null) {
  const eventKey = String(value ?? "").trim();
  if (!eventKey || !getNotificationTemplateDefinition(eventKey)) {
    throw new Error("알림 템플릿 대상을 확인해 주세요.");
  }
  return eventKey;
}

function getBodyFormat(value: FormDataEntryValue | null): NotificationTemplateBodyFormat {
  const bodyFormat = String(value ?? "");
  if (bodyFormat === "plain" || bodyFormat === "markdown" || bodyFormat === "html") {
    return bodyFormat;
  }
  throw new Error("이메일 본문 형식을 확인해 주세요.");
}

export async function updateNotificationTemplateAction(formData: FormData) {
  const session = await requireNotificationTemplateAdmin("update", { path: PATH });
  const eventKey = getEventKey(formData.get("eventKey"));
  const channel = getChannel(formData.get("channel"));
  const titleTemplate = String(formData.get("titleTemplate") ?? "");
  const bodyTemplate = String(formData.get("bodyTemplate") ?? "");
  const bodyFormat = getBodyFormat(formData.get("bodyFormat"));

  try {
    await upsertNotificationTemplate({
      eventKey,
      channel,
      titleTemplate,
      bodyTemplate,
      bodyFormat,
      adminId: session.adminId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알림 템플릿을 저장하지 못했습니다.";
    redirect(`${PATH}?error=${encodeURIComponent(message)}`);
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
  try {
    await resetNotificationTemplate({ eventKey, channel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알림 템플릿을 복원하지 못했습니다.";
    redirect(`${PATH}?error=${encodeURIComponent(message)}`);
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
  if (!memberId) {
    throw new Error("테스트 수신 회원을 선택해 주세요.");
  }
  return memberId;
}

function getSafeTestErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const allowedMessages = [
    "알림 템플릿",
    "테스트 수신 회원",
    "선택한 회원",
    "이메일",
    "Mattermost",
    "푸시",
    "Web Push",
    "SMTP",
    "코드",
    "필수 변수",
    "허용되지 않은 변수",
  ];
  return message && allowedMessages.some((value) => message.includes(value))
    ? message
    : "테스트 발송에 실패했습니다. 채널 설정과 수신 회원 상태를 확인해 주세요.";
}

export async function sendNotificationTemplateTestAction(formData: FormData) {
  await requireNotificationTemplateAdmin("update", { path: PATH });
  const eventKey = getEventKey(formData.get("eventKey"));
  const channel = getChannel(formData.get("channel"));
  const memberId = getMemberId(formData.get("memberId"));
  const titleTemplate = String(formData.get("titleTemplate") ?? "");
  const bodyTemplate = String(formData.get("bodyTemplate") ?? "");
  const bodyFormat = getBodyFormat(formData.get("bodyFormat"));

  try {
    await sendNotificationTemplateTest({
      memberId,
      eventKey,
      channel,
      titleTemplate,
      bodyTemplate,
      bodyFormat,
    });
  } catch (error) {
    redirect(`${PATH}?error=${encodeURIComponent(getSafeTestErrorMessage(error))}`);
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
