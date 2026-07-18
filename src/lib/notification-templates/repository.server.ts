import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getNotificationTemplateDefinition,
  NOTIFICATION_TEMPLATE_CATALOG,
  type NotificationTemplateChannel,
  type NotificationTemplateBodyFormat,
  type NotificationTemplateDefinition,
} from "./catalog";
import {
  classifyNotificationTemplateOverride,
  validateNotificationTemplate,
} from "./template";

type NotificationTemplateRow = {
  event_key: string;
  channel: NotificationTemplateChannel;
  title_template: string;
  body_template: string;
  body_format: NotificationTemplateBodyFormat | string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type ResolvedNotificationTemplate = NotificationTemplateDefinition & {
  titleTemplate: string;
  bodyTemplate: string;
  bodyFormat: NotificationTemplateBodyFormat;
  isCustomized: boolean;
  hasLegacyOverride: boolean;
  customizationError: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

function validateStoredRow(
  definition: NotificationTemplateDefinition,
  row: NotificationTemplateRow,
) {
  const templateValidation = classifyNotificationTemplateOverride(
    definition,
    row.title_template,
    row.body_template,
  );
  const bodyFormat = row.body_format ?? "plain";
  if (
    !isNotificationTemplateBodyFormat(bodyFormat) ||
    (definition.channel !== "email" && bodyFormat !== "plain")
  ) {
    return {
      valid: false,
      error: "기존 사용자 지정 문구의 본문 형식을 확인할 수 없습니다.",
    } as const;
  }
  return templateValidation;
}

function isNotificationTemplateBodyFormat(
  value: unknown,
): value is NotificationTemplateBodyFormat {
  return value === "plain" || value === "markdown" || value === "html";
}

function validateBodyFormat(
  definition: NotificationTemplateDefinition,
  value: unknown,
) {
  if (!isNotificationTemplateBodyFormat(value)) {
    throw new Error("이메일 본문 형식을 확인해 주세요.");
  }
  if (definition.channel !== "email" && value !== "plain") {
    throw new Error("이메일 채널에서만 본문 형식을 변경할 수 있습니다.");
  }
  return value;
}

function toResolvedTemplate(
  definition: NotificationTemplateDefinition,
  row?: NotificationTemplateRow | null,
): ResolvedNotificationTemplate {
  const validation = row ? validateStoredRow(definition, row) : { valid: false, error: null };
  const storedBodyFormat = row?.body_format ?? "plain";
  const bodyFormat =
    row && validation.valid && isNotificationTemplateBodyFormat(storedBodyFormat)
      ? storedBodyFormat
      : definition.bodyFormat;
  return {
    ...definition,
    titleTemplate: validation.valid && row ? row.title_template : definition.titleTemplate,
    bodyTemplate: validation.valid && row ? row.body_template : definition.bodyTemplate,
    bodyFormat,
    isCustomized: validation.valid,
    hasLegacyOverride: Boolean(row && !validation.valid),
    customizationError: validation.error,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };
}
function isMissingTemplateTableError(error: { message?: string | null } | null) {
  const message = error?.message ?? "";
  return (
    message.includes("notification_templates") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

async function listRows() {
  const { data, error } = await getSupabaseAdminClient()
    .from("notification_templates")
    .select("event_key,channel,title_template,body_template,body_format,updated_at,updated_by");
  if (error) {
    if (isMissingTemplateTableError(error)) {
      return [] as NotificationTemplateRow[];
    }
    throw new Error("알림 템플릿을 불러오지 못했습니다.");
  }
  return (data ?? []) as NotificationTemplateRow[];
}

export async function resolveNotificationTemplate(eventKey: string) {
  const definition = getNotificationTemplateDefinition(eventKey);
  if (!definition) {
    throw new Error("알림 템플릿을 찾을 수 없습니다.");
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("notification_templates")
    .select("event_key,channel,title_template,body_template,body_format,updated_at,updated_by")
    .eq("event_key", eventKey)
    .eq("channel", definition.channel)
    .maybeSingle();
  if (error) {
    if (isMissingTemplateTableError(error)) {
      return toResolvedTemplate(definition);
    }
    return toResolvedTemplate(definition);
  }

  const row = data as NotificationTemplateRow | null;
  if (!row) {
    return toResolvedTemplate(definition);
  }

  if (validateStoredRow(definition, row).valid) {
    return toResolvedTemplate(definition, row);
  }
  return toResolvedTemplate(definition, row);
}

export async function listNotificationTemplates() {
  const rows = await listRows();
  const rowByKey = new Map(
    rows.map((row) => [`${row.event_key}:${row.channel}`, row]),
  );
  return NOTIFICATION_TEMPLATE_CATALOG.map((definition) =>
    toResolvedTemplate(
      definition,
      rowByKey.get(`${definition.eventKey}:${definition.channel}`) ?? null,
    ),
  );
}

export async function upsertNotificationTemplate(input: {
  eventKey: string;
  channel: NotificationTemplateChannel;
  titleTemplate: string;
  bodyTemplate: string;
  bodyFormat?: NotificationTemplateBodyFormat;
  adminId: string;
}) {
  const definition = getNotificationTemplateDefinition(input.eventKey);
  if (!definition || definition.channel !== input.channel) {
    throw new Error("알림 템플릿 대상을 확인해 주세요.");
  }
  const bodyFormat = validateBodyFormat(
    definition,
    input.bodyFormat ?? definition.bodyFormat,
  );
  const validated = validateNotificationTemplate(
    definition,
    input.titleTemplate,
    input.bodyTemplate,
  );

  const { error } = await getSupabaseAdminClient()
    .from("notification_templates")
    .upsert(
      {
        event_key: input.eventKey,
        channel: input.channel,
        title_template: validated.title,
        body_template: validated.body,
        body_format: bodyFormat,
        updated_by: input.adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_key,channel" },
    );
  if (error) {
    throw new Error("알림 템플릿을 저장하지 못했습니다.");
  }
}

export async function resetNotificationTemplate(input: {
  eventKey: string;
  channel: NotificationTemplateChannel;
}) {
  const definition = getNotificationTemplateDefinition(input.eventKey);
  if (!definition || definition.channel !== input.channel) {
    throw new Error("알림 템플릿 대상을 확인해 주세요.");
  }
  const { error } = await getSupabaseAdminClient()
    .from("notification_templates")
    .delete()
    .eq("event_key", input.eventKey)
    .eq("channel", input.channel);
  if (error && !isMissingTemplateTableError(error)) {
    throw new Error("알림 템플릿을 기본값으로 복원하지 못했습니다.");
  }
}
