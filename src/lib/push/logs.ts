import { getSupabaseAdminClient } from "../supabase/server.ts";
import { isMissingPushTableError, wrapPushDbError } from "./config.ts";
import { PushError } from "./types.ts";
import type {
  PushMessageLog,
  PushPayload,
  ResolvedPushAudience,
  StoredSubscription,
} from "./types.ts";

export async function logPushDelivery(params: {
  messageLogId?: string | null;
  memberId: string;
  subscriptionId: string;
  payload: PushPayload;
  status: "sent" | "failed";
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("push_delivery_logs").insert({
    message_log_id: params.messageLogId ?? null,
    member_id: params.memberId,
    subscription_id: params.subscriptionId,
    type: params.payload.type,
    title: params.payload.title,
    body: params.payload.body,
    url: params.payload.url ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null,
  });
}

export async function createPushMessageLog(params: {
  payload: PushPayload;
  source: "manual" | "automatic";
  audience: ResolvedPushAudience;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_message_logs")
    .insert({
      type: params.payload.type,
      source: params.source,
      target_scope: params.audience.scope,
      target_label: params.audience.label,
      target_year: params.audience.year,
      target_campus: params.audience.campus,
      target_member_id: params.audience.memberId,
      title: params.payload.title,
      body: params.payload.body,
      url: params.payload.url ?? null,
      status: "pending",
    })
    .select(
      "id,type,source,target_scope,target_label,target_year,target_campus,target_member_id,title,body,url,status,targeted,delivered,failed,created_at,completed_at",
    )
    .single();

  if (error) {
    throw wrapPushDbError(error, "Push 메시지 로그를 저장하지 못했습니다.");
  }

  return data as PushMessageLog;
}

export async function finalizePushMessageLog(params: {
  id: string;
  targeted: number;
  delivered: number;
  failed: number;
}) {
  const status =
    params.targeted === 0
      ? "no_target"
      : params.delivered === 0
        ? "failed"
        : params.failed > 0
          ? "partial_failed"
          : "sent";

  const supabase = getSupabaseAdminClient();
  await supabase
    .from("push_message_logs")
    .update({
      status,
      targeted: params.targeted,
      delivered: params.delivered,
      failed: params.failed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.id);
}

export async function getRecentPushMessageLogs(limit = 200) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_message_logs")
    .select(
      "id,type,source,target_scope,target_label,target_year,target_campus,target_member_id,title,body,url,status,targeted,delivered,failed,created_at,completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingPushTableError(error)) {
      return [] as PushMessageLog[];
    }
    throw wrapPushDbError(error, "Push 메시지 로그를 불러오지 못했습니다.");
  }

  return (data ?? []) as PushMessageLog[];
}

export async function deletePushMessageLog(logId: string) {
  const id = logId.trim();
  if (!id) {
    throw new PushError("not_found", "삭제할 로그를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("push_message_logs").delete().eq("id", id);

  if (error) {
    throw wrapPushDbError(error, "Push 메시지 로그를 삭제하지 못했습니다.");
  }
}

export async function markPushSuccess(subscriptionId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("push_subscriptions")
    .update({
      last_success_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq("id", subscriptionId);
}

export async function markPushFailure(
  subscription: StoredSubscription,
  errorMessage: string,
  deactivate: boolean,
) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("push_subscriptions")
    .update({
      is_active: deactivate ? false : true,
      last_failure_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      failure_reason: errorMessage,
    })
    .eq("id", subscription.id);
}
