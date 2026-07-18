import { notificationRepository } from "@/lib/repositories";
import { getMmUserDirectoryEntriesByAccountIds } from "@/lib/mm-directory/identities";
import { withActiveMattermostSenderForSubject } from "@/lib/mattermost-senders/service";
import { renderEmailTemplateBody } from "@/lib/email-content";
import { SITE_NAME } from "@/lib/site";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import { sendPushTemplateTest } from "@/lib/push/send";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getNotificationTemplateDefinition,
  NOTIFICATION_TEMPLATE_CHANNELS,
  type NotificationTemplateBodyFormat,
  type NotificationTemplateChannel,
} from "./catalog";
import {
  getNotificationTemplateTestVariables,
  getTestPushNotificationType,
  type NotificationTemplateTestRecipientOption,
  type NotificationTemplateTestRecipientProfile,
} from "./test-delivery";
import {
  renderNotificationTemplate,
  validateNotificationTemplate,
} from "./template";

type MemberRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  mattermost_account_id: string | null;
  deleted_at: string | null;
};

type TestRecipientRecord = NotificationTemplateTestRecipientProfile & {
  id: string;
  mmUserId: string | null;
  isStaff: boolean;
  sourceYears: number[];
  hasPushSubscription: boolean;
};

const MEMBER_SELECT =
  "id,display_name,email,generation,staff_source_generation,mattermost_account_id,deleted_at";

function normalizeText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

function normalizeGeneration(member: MemberRow) {
  const generation = member.generation ?? 0;
  return Number.isSafeInteger(generation) && generation >= 0 ? generation : 0;
}

function normalizeSourceYears(
  directorySourceYears: number[] | null | undefined,
  member: MemberRow,
) {
  const values = [
    ...(directorySourceYears ?? []),
    member.staff_source_generation ?? 0,
  ].filter((value) => Number.isSafeInteger(value) && value > 0);
  return [...new Set(values)];
}

function toRecipientRecord(
  member: MemberRow,
  directory: {
    mm_user_id: string;
    mm_username: string;
    is_staff: boolean;
    source_years: number[];
  } | null,
  hasPushSubscription: boolean,
): TestRecipientRecord {
  const generation = normalizeGeneration(member);
  const isStaff = directory?.is_staff ?? generation === 0;
  const displayName = normalizeText(
    member.display_name ?? directory?.mm_username,
    "이름 없는 회원",
  );
  const loginId = normalizeText(
    directory?.mm_username,
    member.id.slice(0, 8),
  );

  return {
    id: member.id,
    displayName,
    loginId,
    email: member.email?.trim() || null,
    generation,
    mmUserId: directory?.mm_user_id ?? null,
    isStaff,
    sourceYears: normalizeSourceYears(directory?.source_years, member),
    hasPushSubscription,
  };
}

async function getPushSubscriptionMemberIds(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("push_subscriptions")
    .select("member_id")
    .in("member_id", memberIds)
    .eq("is_active", true);
  if (error) {
    return new Set<string>();
  }

  return new Set((data ?? []).map((row) => String(row.member_id)));
}

async function getMemberRows() {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select(MEMBER_SELECT)
    .is("deleted_at", null)
    .order("display_name", { ascending: true })
    .limit(500);
  if (error) {
    throw new Error("테스트 수신 회원을 불러오지 못했습니다.");
  }

  return (data ?? []) as MemberRow[];
}

async function getRecipientRecords() {
  const members = await getMemberRows();
  const directoryByAccountId = await getMmUserDirectoryEntriesByAccountIds(
    members
      .map((member) => member.mattermost_account_id)
      .filter((id): id is string => Boolean(id)),
  );
  const pushMemberIds = await getPushSubscriptionMemberIds(
    members.map((member) => member.id),
  );

  return members.map((member) => {
    const directory = member.mattermost_account_id
      ? directoryByAccountId.get(member.mattermost_account_id)
      : null;
    return toRecipientRecord(
      member,
      directory
        ? {
            mm_user_id: directory.mm_user_id,
            mm_username: directory.mm_username,
            is_staff: directory.is_staff,
            source_years: directory.source_years,
          }
        : null,
      pushMemberIds.has(member.id),
    );
  });
}

function getRecipientLabel(recipient: TestRecipientRecord) {
  const generationLabel = recipient.isStaff
    ? "운영진"
    : `${recipient.generation}기`;
  return `${recipient.displayName} (${recipient.loginId}) · ${generationLabel}`;
}

export async function listNotificationTemplateTestRecipients() {
  const recipients = await getRecipientRecords();
  const defaultRecipient = recipients.find(
    (recipient) => recipient.loginId.toLowerCase() === "myknow",
  );
  const defaultId = defaultRecipient?.id ?? recipients[0]?.id ?? null;

  return {
    defaultId,
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      label: getRecipientLabel(recipient),
      displayName: recipient.displayName,
      loginId: recipient.loginId,
      generation: recipient.generation,
      channels: [
        "in_app",
        ...(recipient.email ? ["email" as const] : []),
        ...(recipient.mmUserId ? ["mattermost" as const] : []),
        ...(recipient.hasPushSubscription ? ["push" as const] : []),
      ],
      isDefault: recipient.id === defaultId,
    } satisfies NotificationTemplateTestRecipientOption)),
  };
}

async function getRecipientById(memberId: string) {
  const normalizedId = memberId.trim();
  if (!normalizedId) {
    throw new Error("테스트 수신 회원을 선택해 주세요.");
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select(MEMBER_SELECT)
    .eq("id", normalizedId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) {
    throw new Error("테스트 수신 회원을 찾을 수 없습니다.");
  }

  const member = data as MemberRow;
  const directoryByAccountId = await getMmUserDirectoryEntriesByAccountIds(
    member.mattermost_account_id ? [member.mattermost_account_id] : [],
  );
  const directory = member.mattermost_account_id
    ? directoryByAccountId.get(member.mattermost_account_id)
    : null;
  const pushMemberIds = await getPushSubscriptionMemberIds([member.id]);

  return toRecipientRecord(
    member,
    directory
      ? {
          mm_user_id: directory.mm_user_id,
          mm_username: directory.mm_username,
          is_staff: directory.is_staff,
          source_years: directory.source_years,
        }
      : null,
    pushMemberIds.has(member.id),
  );
}

function getBodyFormat(
  channel: NotificationTemplateChannel,
  value: string,
): NotificationTemplateBodyFormat {
  if (channel !== "email") {
    return "plain";
  }
  if (value === "plain" || value === "markdown" || value === "html") {
    return value;
  }
  throw new Error("이메일 본문 형식을 확인해 주세요.");
}

function getTargetUrl(variables: Record<string, string | number>) {
  const value = variables.targetUrl;
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/notifications";
}

function getRenderedTemplate(input: {
  eventKey: string;
  channel: NotificationTemplateChannel;
  titleTemplate: string;
  bodyTemplate: string;
  bodyFormat: string;
  recipient: TestRecipientRecord;
}) {
  const definition = getNotificationTemplateDefinition(input.eventKey);
  if (!definition || definition.channel !== input.channel) {
    throw new Error("알림 템플릿 대상을 확인해 주세요.");
  }
  const bodyFormat = getBodyFormat(input.channel, input.bodyFormat);
  const validated = validateNotificationTemplate(
    definition,
    input.titleTemplate,
    input.bodyTemplate,
  );
  const variables = getNotificationTemplateTestVariables(definition, input.recipient);
  const title = renderNotificationTemplate(validated.title, variables);
  const body = renderNotificationTemplate(validated.body, variables);

  return { definition, bodyFormat, variables, title, body };
}

export async function sendNotificationTemplateTest(input: {
  memberId: string;
  eventKey: string;
  channel: NotificationTemplateChannel;
  titleTemplate: string;
  bodyTemplate: string;
  bodyFormat: string;
}) {
  if (!NOTIFICATION_TEMPLATE_CHANNELS.includes(input.channel)) {
    throw new Error("알림 채널을 확인해 주세요.");
  }

  const recipient = await getRecipientById(input.memberId);
  const rendered = getRenderedTemplate({ ...input, recipient });

  if (input.channel === "email") {
    if (!recipient.email) {
      throw new Error("선택한 회원에 등록된 이메일 주소가 없습니다.");
    }
    const smtpConfig = getSmtpConfig();
    const transporter = createSmtpTransport(smtpConfig);
    const emailBody = renderEmailTemplateBody(
      input.bodyTemplate,
      rendered.bodyFormat,
      rendered.variables,
    );
    await transporter.sendMail({
      from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
      to: recipient.email,
      subject: rendered.title.replace(/[\r\n]+/g, " ").trim(),
      text: emailBody.text,
      html: emailBody.html,
    });
  } else if (input.channel === "mattermost") {
    if (!recipient.mmUserId) {
      throw new Error("선택한 회원에 연결된 Mattermost 계정이 없습니다.");
    }
    await withActiveMattermostSenderForSubject(
      {
        generation: recipient.generation,
        isStaff: recipient.isStaff,
        sourceYears: recipient.sourceYears,
      },
      (session) => session.sendDirectMessage(
        recipient.mmUserId as string,
        [rendered.title, rendered.body].filter(Boolean).join("\n\n"),
      ),
    );
  } else if (input.channel === "push") {
    const result = await sendPushTemplateTest({
      memberId: recipient.id,
      payload: {
        type: getTestPushNotificationType(input.eventKey),
        title: rendered.title,
        body: rendered.body,
        url: getTargetUrl(rendered.variables),
        tag: `notification-template-test:${input.eventKey}`,
      },
    });
    if (result.delivered === 0) {
      throw new Error("선택한 회원의 활성 푸시 구독으로 발송하지 못했습니다.");
    }
  } else {
    await notificationRepository.createNotification({
      type: "notification_template_test",
      title: rendered.title,
      body: rendered.body,
      targetUrl: getTargetUrl(rendered.variables),
      metadata: {
        templateTest: true,
        eventKey: input.eventKey,
        channel: input.channel,
      },
      recipientMemberIds: [recipient.id],
    });
  }

  return {
    recipientLabel: getRecipientLabel(recipient),
    channel: input.channel,
  };
}
