import { getMemberNotificationPreferences } from "@/lib/notification-preferences";
import { fetchMemberVisibleReviewCountInRange } from "@/lib/partner-counts";
import { collectPagedRows } from "@/lib/supabase/paging";
import { getMmUserDirectoryEntriesByAccountIds } from "@/lib/mm-directory/identities";
import {
  MEMBER_EVENT_CANDIDATE_SELECT,
  type MemberEventCandidateRow,
} from "@/lib/members/projections";
import { getPolicyDocumentByKind } from "@/lib/policy-documents.server";
import { hasEffectiveMarketingConsent } from "@/lib/notifications/marketing-consent";
import { getPushPreferencesOrDefault } from "@/lib/push";
import type { DrawAuditSummary, DrawSeedSource } from "@/lib/draw-audit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { EventCampaign } from "@/lib/promotions/catalog";
import type { EventRewardDeliveryRecord } from "@/lib/promotions/event-reward-delivery";
import type {
  EventRewardDrawPlan,
  EventRewardDrawRequest,
  EventRewardDrawStatus,
  EventRewardNotificationSendStatus,
  EventRewardStoredDraw,
  EventRewardStoredWinner,
  EventRewardSummary,
  EventRewardWinnerNotificationStatus,
} from "@/lib/promotions/event-rewards-types";
import {
  buildEventRewardAdminOverview,
  calculateEventRewardConditions,
  sumEventRewardTickets,
  type MemberRewardSnapshot,
} from "@/lib/promotions/event-rewards-eligibility";
import {
  buildEventRewardDrawAudit,
  createEventRewardDrawPlan,
  EventRewardSafeError,
  getEventRewardWinnerGuidePath,
} from "@/lib/promotions/event-rewards-draw";

type PreferenceRow = {
  member_id: string | null;
  enabled: boolean | null;
  mm_enabled: boolean | null;
  marketing_enabled: boolean | null;
};

type ReviewRow = {
  member_id: string | null;
};

type PolicyConsentRow = {
  member_id: string | null;
};

type EventRewardDrawRow = {
  id: string;
  event_slug: string;
  status: EventRewardDrawStatus;
  seed: string;
  winner_count: number;
  candidate_count: number;
  total_tickets: number;
  google_form_url: string;
  guide_path: string;
  sent_notification_id: string | null;
  metadata: Record<string, unknown> | null;
  created_by_admin_id: string | null;
  created_at: string;
  finalized_at: string | null;
  sent_at: string | null;
  updated_at: string;
};

type EventRewardWinnerRow = {
  id: string;
  draw_id: string;
  event_slug: string;
  member_id: string;
  winner_rank: number;
  ticket_count: number;
  display_name: string | null;
  mm_username: string | null;
  year: number | null;
  campus: string | null;
  notification_status: EventRewardWinnerNotificationStatus;
  notification_sent_at: string | null;
  notification_error: string | null;
  created_at: string;
  updated_at: string;
};

const EVENT_REWARD_DRAW_SELECT =
  "id,event_slug,status,seed,winner_count,candidate_count,total_tickets,google_form_url,guide_path,sent_notification_id,metadata,created_by_admin_id,created_at,finalized_at,sent_at,updated_at";
const EVENT_REWARD_WINNER_SELECT =
  "id,draw_id,event_slug,member_id,winner_rank,ticket_count,display_name,mm_username,year,campus,notification_status,notification_sent_at,notification_error,created_at,updated_at";

type EventRewardSupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

function assertEventRewardQuerySucceeded(error: unknown, label: string) {
  if (!error) {
    return;
  }
  const message = error instanceof Error && error.message ? error.message : String(error);
  throw new Error(`이벤트 추첨권 현황 조회에 실패했습니다. (${label}: ${message})`);
}

async function getMemberRewardSnapshot(
  memberId: string,
  campaign: EventCampaign,
): Promise<MemberRewardSnapshot> {
  const supabase = getSupabaseAdminClient();
  const [memberResult, preferences, reviewResult] = await Promise.all([
    supabase.from("members").select("created_at").eq("id", memberId).maybeSingle(),
    getMemberNotificationPreferences(memberId).catch(() => null),
    fetchMemberVisibleReviewCountInRange(
      supabase,
      memberId,
      campaign.startsAt,
      campaign.endsAt,
    ),
  ]);

  return {
    createdAt:
      typeof memberResult.data?.created_at === "string" ? memberResult.data.created_at : null,
    preferences,
    reviewCount: reviewResult.count,
  };
}

export async function getEventRewardSummary(params: {
  campaign: EventCampaign;
  memberId?: string | null;
}): Promise<EventRewardSummary> {
  if (!params.memberId) {
    return {
      authenticated: false,
      totalTickets: 0,
      conditions: params.campaign.conditions.map((condition) => ({
        key: condition.key,
        status: "missing",
        earnedTickets: 0,
        currentCount: condition.repeatable ? 0 : undefined,
      })),
    };
  }

  const snapshot = await getMemberRewardSnapshot(params.memberId, params.campaign);

  const conditions = calculateEventRewardConditions(params.campaign, snapshot);

  return {
    authenticated: true,
    totalTickets: sumEventRewardTickets(conditions),
    conditions,
  };
}

function mapWinnerRow(row: EventRewardWinnerRow): EventRewardStoredWinner {
  return {
    id: row.id,
    drawId: row.draw_id,
    eventSlug: row.event_slug,
    memberId: row.member_id,
    rank: row.winner_rank,
    ticketCount: row.ticket_count,
    displayName: row.display_name,
    mmUsername: row.mm_username ?? "",
    year: row.year ?? 0,
    campus: row.campus,
    notificationStatus: row.notification_status,
    notificationSentAt: row.notification_sent_at,
    notificationError: row.notification_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDrawRow(
  row: EventRewardDrawRow,
  winners: EventRewardWinnerRow[],
): EventRewardStoredDraw {
  return {
    id: row.id,
    eventSlug: row.event_slug,
    status: row.status,
    seed: row.seed,
    winnerCount: row.winner_count,
    candidateCount: row.candidate_count,
    totalTickets: row.total_tickets,
    googleFormUrl: row.google_form_url,
    guidePath: row.guide_path,
    sentNotificationId: row.sent_notification_id,
    createdByAdminId: row.created_by_admin_id,
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
    sentAt: row.sent_at,
    updatedAt: row.updated_at,
    winners: winners
      .map(mapWinnerRow)
      .sort((left, right) => left.rank - right.rank),
  };
}

function normalizePreferences(params: {
  row?: PreferenceRow | null;
  hasActiveMarketingPolicy: boolean;
  hasCurrentMarketingPolicyConsent: boolean;
}): MemberRewardSnapshot["preferences"] {
  const preferences = getPushPreferencesOrDefault(
    params.row
      ? {
          enabled: params.row.enabled ?? undefined,
          mmEnabled: params.row.mm_enabled ?? undefined,
        }
      : null,
  );
  return {
    enabled: preferences.enabled,
    mmEnabled: preferences.mmEnabled,
    marketingEnabled: hasEffectiveMarketingConsent({
      hasActiveMarketingPolicy: params.hasActiveMarketingPolicy,
      hasCurrentPolicyConsent: params.hasCurrentMarketingPolicyConsent,
      marketingEnabled: params.row?.marketing_enabled,
    }),
  };
}

async function fetchAllEventMembers(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const result = await collectPagedRows<MemberEventCandidateRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("members")
      .select(MEMBER_EVENT_CANDIDATE_SELECT)
      .is("deleted_at", null)
      // 추첨 후보 순서(동점·동명 tie-break)가 이 정렬에 의존하므로 PK 정렬로 바꾸지 않는다.
      .order("generation", { ascending: false })
      .order("display_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    assertEventRewardQuerySucceeded(error, "members");
    return { rows: (data ?? []) as MemberEventCandidateRow[], error: false };
  });
  return result.rows;
}

async function fetchAllEventMarketingConsentMemberIds(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  policyDocumentId: string | null | undefined,
) {
  if (!policyDocumentId) {
    return new Set<string>();
  }

  const result = await collectPagedRows<PolicyConsentRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("member_policy_consents")
      .select("member_id")
      .eq("policy_document_id", policyDocumentId)
      .order("member_id", { ascending: true })
      .range(from, to);
    assertEventRewardQuerySucceeded(error, "member_policy_consents");
    return { rows: (data ?? []) as PolicyConsentRow[], error: false };
  });

  return new Set(
    result.rows.flatMap((row) => (row.member_id ? [row.member_id] : [])),
  );
}

async function fetchAllEventPreferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const result = await collectPagedRows<PreferenceRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("push_preferences")
      .select("member_id,enabled,mm_enabled,marketing_enabled")
      .order("member_id", { ascending: true })
      .range(from, to);
    assertEventRewardQuerySucceeded(error, "push_preferences");
    return { rows: (data ?? []) as PreferenceRow[], error: false };
  });
  return result.rows;
}

async function fetchAllEventReviewCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  campaign: EventCampaign,
) {
  const result = await collectPagedRows<ReviewRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("partner_reviews")
      .select("member_id")
      .gte("created_at", campaign.startsAt)
      .lte("created_at", campaign.endsAt)
      .is("deleted_at", null)
      .is("hidden_at", null)
      .order("member_id", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    assertEventRewardQuerySucceeded(error, "partner_reviews");
    return { rows: (data ?? []) as ReviewRow[], error: false };
  });
  const counts = new Map<string, number>();
  for (const row of result.rows) {
    if (!row.member_id) {
      continue;
    }
    counts.set(row.member_id, (counts.get(row.member_id) ?? 0) + 1);
  }
  return counts;
}

export async function getEventRewardAdminOverview(campaign: EventCampaign) {
  const supabase = getSupabaseAdminClient();
  const [members, preferences, reviewCounts, activeMarketingPolicy] =
    await Promise.all([
      fetchAllEventMembers(supabase),
      fetchAllEventPreferences(supabase),
      fetchAllEventReviewCounts(supabase, campaign),
      getPolicyDocumentByKind("marketing").catch(() => null),
    ]);
  const [directoryByAccountId, marketingConsentMemberIds] = await Promise.all([
    getMmUserDirectoryEntriesByAccountIds(
      members.flatMap((member) =>
        member.mattermost_account_id ? [member.mattermost_account_id] : [],
      ),
    ),
    fetchAllEventMarketingConsentMemberIds(
      supabase,
      activeMarketingPolicy?.id,
    ),
  ]);
  const preferenceMap = new Map(preferences.map((row) => [row.member_id ?? "", row]));

  return buildEventRewardAdminOverview(
    campaign,
    members.map((member) => {
      const directory = member.mattermost_account_id
        ? directoryByAccountId.get(member.mattermost_account_id)
        : null;
      return {
        id: member.id,
        displayName: member.display_name,
        mmUsername: directory?.mm_username ?? "",
        year: member.generation ?? 0,
        campus: member.campus,
        createdAt: member.created_at,
        preferences: normalizePreferences({
          row: preferenceMap.get(member.id),
          hasActiveMarketingPolicy: Boolean(activeMarketingPolicy),
          hasCurrentMarketingPolicyConsent: marketingConsentMemberIds.has(member.id),
        }),
        reviewCount: reviewCounts.get(member.id) ?? 0,
      };
    }),
  );
}

export async function getLatestEventRewardDrawWithWinners(eventSlug: string) {
  const supabase = getSupabaseAdminClient();
  const { data: draw, error: drawError } = await supabase
    .from("event_reward_draws")
    .select(EVENT_REWARD_DRAW_SELECT)
    .eq("event_slug", eventSlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (drawError) {
    throw new Error(drawError.message);
  }
  if (!draw) {
    return null;
  }

  const { data: winners, error: winnerError } = await supabase
    .from("event_reward_winners")
    .select(EVENT_REWARD_WINNER_SELECT)
    .eq("draw_id", draw.id)
    .order("winner_rank", { ascending: true });
  if (winnerError) {
    throw new Error(winnerError.message);
  }

  return mapDrawRow(
    draw as EventRewardDrawRow,
    (winners ?? []) as EventRewardWinnerRow[],
  );
}

/**
 * Stores a finalized draw and its winners. PostgREST cannot wrap both inserts
 * in one transaction, so a failed winner insert deletes the draw again;
 * otherwise the finalized row would hold the one-finalized-draw-per-event index
 * and block every later draw for the event.
 */
export async function persistEventRewardDraw(
  supabase: EventRewardSupabaseClient,
  params: {
    campaign: EventCampaign;
    plan: EventRewardDrawPlan;
    googleFormUrl: string;
    createdByAdminId?: string | null;
    finalizedAt: string;
    audit?: DrawAuditSummary;
  },
) {
  const { campaign, plan } = params;
  if (plan.winners.length === 0) {
    throw new EventRewardSafeError(
      "추첨권을 가진 후보가 없어 추첨을 확정할 수 없습니다.",
    );
  }
  const guidePath = getEventRewardWinnerGuidePath(campaign.slug);
  const { data: draw, error: drawError } = await supabase
    .from("event_reward_draws")
    .insert({
      event_slug: campaign.slug,
      status: "finalized",
      seed: plan.seed,
      winner_count: plan.winnerCount,
      candidate_count: plan.candidateCount,
      total_tickets: plan.totalTickets,
      google_form_url: params.googleFormUrl,
      guide_path: guidePath,
      created_by_admin_id: params.createdByAdminId ?? null,
      finalized_at: params.finalizedAt,
      metadata: {
        campaignTitle: campaign.title,
        campaignStartsAt: campaign.startsAt,
        campaignEndsAt: campaign.endsAt,
        ...(params.audit ? { audit: params.audit } : {}),
      },
    })
    .select(EVENT_REWARD_DRAW_SELECT)
    .single();

  if (drawError) {
    if (drawError.message.includes("event_reward_draws_one_finalized_per_event")) {
      throw new EventRewardSafeError("이미 확정된 추첨이 있습니다.");
    }
    throw new Error(drawError.message);
  }

  const winnerRows = plan.winners.map((winner) => ({
    draw_id: draw.id,
    event_slug: campaign.slug,
    member_id: winner.memberId,
    winner_rank: winner.rank,
    ticket_count: winner.ticketCount,
    display_name: winner.displayName,
    mm_username: winner.mmUsername,
    year: winner.year,
    campus: winner.campus,
  }));

  const { data: winners, error: winnerError } = await supabase
    .from("event_reward_winners")
    .insert(winnerRows)
    .select(EVENT_REWARD_WINNER_SELECT);
  if (winnerError) {
    const { error: cleanupError } = await supabase
      .from("event_reward_draws")
      .delete()
      .eq("id", draw.id);
    if (cleanupError) {
      console.error("[event-rewards] draw rollback failed after winner insert failure", {
        drawId: draw.id,
        winnerErrorCode: winnerError.code ?? null,
        cleanupErrorCode: cleanupError.code ?? null,
      });
      throw new EventRewardSafeError(
        "당첨자 저장에 실패했고 추첨 기록을 되돌리지 못했습니다. 운영 로그를 확인한 뒤 다시 시도해 주세요.",
      );
    }
    console.error("[event-rewards] winner insert failed; draw rolled back", {
      drawId: draw.id,
      winnerErrorCode: winnerError.code ?? null,
    });
    throw new EventRewardSafeError(
      "당첨자 저장에 실패해 추첨을 되돌렸습니다. 다시 확정해 주세요.",
    );
  }

  return mapDrawRow(
    draw as EventRewardDrawRow,
    (winners ?? []) as EventRewardWinnerRow[],
  );
}

export async function createStoredEventRewardDraw(params: {
  campaign: EventCampaign;
  request: EventRewardDrawRequest;
  seedSource: Extract<DrawSeedSource, "admin" | "generated">;
  createdByAdminId?: string | null;
}) {
  const overview = await getEventRewardAdminOverview(params.campaign);
  const plan = createEventRewardDrawPlan(overview, {
    winnerCount: params.request.winnerCount,
    seed: params.request.seed,
  });
  const audit = buildEventRewardDrawAudit(overview, params.seedSource);
  const draw = await persistEventRewardDraw(getSupabaseAdminClient(), {
    campaign: params.campaign,
    plan,
    googleFormUrl: params.request.googleFormUrl,
    createdByAdminId: params.createdByAdminId,
    finalizedAt: new Date().toISOString(),
    audit,
  });
  return { ...draw, audit };
}

async function getEventRewardDrawRowForNotification(
  drawId: string,
  eventSlug: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data: drawRow, error: drawError } = await supabase
    .from("event_reward_draws")
    .select(EVENT_REWARD_DRAW_SELECT)
    .eq("id", drawId)
    .eq("event_slug", eventSlug)
    .maybeSingle();
  if (drawError) {
    throw new Error(drawError.message);
  }
  if (!drawRow) {
    throw new EventRewardSafeError("추첨 결과를 찾을 수 없습니다.");
  }
  return { supabase, drawRow: drawRow as EventRewardDrawRow };
}

type EventRewardDeliveryRow = {
  notification_id: string | null;
  member_id: string | null;
  channel: string | null;
  status: string | null;
  provider_status: string | null;
};

/** Returns null when the delivery ledger cannot be read, so callers fail closed. */
async function fetchEventRewardDeliveryRecords(
  supabase: EventRewardSupabaseClient,
  notificationIds: readonly string[],
  memberIds: readonly string[],
): Promise<EventRewardDeliveryRecord[] | null> {
  if (notificationIds.length === 0 || memberIds.length === 0) {
    return [];
  }
  const result = await collectPagedRows<EventRewardDeliveryRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("notification_deliveries")
      .select("notification_id,member_id,channel,status,provider_status")
      .in("notification_id", [...notificationIds])
      .in("member_id", [...memberIds])
      .order("id", { ascending: true })
      .range(from, to);
    if (error) {
      console.error("[event-rewards] delivery ledger lookup failed", {
        code: error.code ?? null,
      });
      return { rows: [], error: true };
    }
    return { rows: (data ?? []) as EventRewardDeliveryRow[], error: false };
  });
  if (result.partialFailure) {
    return null;
  }
  return result.rows.flatMap((row) =>
    row.notification_id && row.member_id && row.channel && row.status
      ? [
          {
            notificationId: row.notification_id,
            memberId: row.member_id,
            channel: row.channel,
            status: row.status,
            providerStatus: row.provider_status,
          },
        ]
      : [],
  );
}

function hasDrawWriteReceipt(data: unknown, drawId: string) {
  return typeof data === "object" && data !== null && !Array.isArray(data)
    && "id" in data && data.id === drawId;
}

function readWinnerWriteReceipt(
  row: unknown,
  drawId: string,
  expectedStatus: EventRewardWinnerNotificationStatus,
) {
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
  const receipt = row as Record<string, unknown>;
  return receipt.draw_id === drawId && receipt.notification_status === expectedStatus
    && typeof receipt.member_id === "string" ? receipt.member_id : null;
}

async function updateEventRewardWinnerNotificationRows(
  supabase: EventRewardSupabaseClient,
  drawId: string,
  memberIds: readonly string[],
  values: {
    notification_status: EventRewardWinnerNotificationStatus;
    notification_sent_at?: string | null;
    notification_error: string | null;
  },
) {
  if (memberIds.length === 0) {
    return;
  }
  let update = supabase.from("event_reward_winners").update(values)
    .eq("draw_id", drawId).in("member_id", [...memberIds]);
  if (values.notification_status !== "sent") update = update.neq("notification_status", "sent");
  const { data, error } = await update.select("draw_id,member_id,notification_status");
  if (error) throw new Error(error.message);
  const incomplete = () => new EventRewardSafeError(
    "당첨자별 발송 기록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  );
  // PostgREST SDK can normalize a 404 response to error:null with null/[].
  // Only explicit matching rows establish that this summary was persisted.
  if (!Array.isArray(data)) throw incomplete();
  const expected = new Set(memberIds);
  const recorded = new Set<string>();
  for (const row of data) {
    const memberId = readWinnerWriteReceipt(row, drawId, values.notification_status);
    if (!memberId || !expected.has(memberId) || recorded.has(memberId)) throw incomplete();
    recorded.add(memberId);
  }
  const missing = [...expected].filter((memberId) => !recorded.has(memberId));
  if (missing.length === 0) return;
  if (values.notification_status === "sent") throw incomplete();

  // A concurrent worker may already have advanced a row to sent. The neq guard
  // preserves it; absence from the PATCH response alone is not evidence of that.
  const { data: preserved, error: preservedError } = await supabase
    .from("event_reward_winners").select("draw_id,member_id,notification_status")
    .eq("draw_id", drawId).in("member_id", missing).eq("notification_status", "sent");
  if (preservedError || !Array.isArray(preserved)) throw incomplete();
  const confirmed = new Set<string>();
  for (const row of preserved) {
    const memberId = readWinnerWriteReceipt(row, drawId, "sent");
    if (!memberId || !missing.includes(memberId) || confirmed.has(memberId)) throw incomplete();
    confirmed.add(memberId);
  }
  if (confirmed.size !== missing.length) throw incomplete();
}

export async function getEventRewardWinnerGuide(params: {
  eventSlug: string;
  memberId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: winner, error: winnerError } = await supabase
    .from("event_reward_winners")
    .select("draw_id,member_id,winner_rank,ticket_count")
    .eq("event_slug", params.eventSlug)
    .eq("member_id", params.memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (winnerError) {
    throw new Error(winnerError.message);
  }
  if (!winner) {
    return null;
  }

  const { data: draw, error: drawError } = await supabase
    .from("event_reward_draws")
    .select("id,event_slug,status,google_form_url,guide_path,sent_at")
    .eq("id", winner.draw_id)
    .maybeSingle();
  if (drawError) {
    throw new Error(drawError.message);
  }
  if (!draw) {
    return null;
  }

  return {
    eventSlug: draw.event_slug as string,
    drawId: draw.id as string,
    status: draw.status as EventRewardDrawRow["status"],
    googleFormUrl: draw.google_form_url as string,
    guidePath: draw.guide_path as string,
    sentAt: draw.sent_at as string | null,
    rank: winner.winner_rank as number,
    ticketCount: winner.ticket_count as number,
  };
}

/** One data-access boundary for a notification attempt, including write receipts. */
export async function getEventRewardNotificationRepository(drawId: string, eventSlug: string) {
  const { supabase, drawRow } = await getEventRewardDrawRowForNotification(drawId, eventSlug);
  return {
    draw: {
      status: drawRow.status,
      sentAt: drawRow.sent_at,
      guidePath: drawRow.guide_path,
      sentNotificationId: drawRow.sent_notification_id,
      metadata: drawRow.metadata,
    },
    async getWinnerMemberIds() {
      const { data, error } = await supabase
        .from("event_reward_winners")
        .select(EVENT_REWARD_WINNER_SELECT)
        .eq("draw_id", drawId)
        .order("winner_rank", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as EventRewardWinnerRow[]).map((winner) => winner.member_id);
    },
    fetchDeliveryRecords(notificationIds: readonly string[], memberIds: readonly string[]) {
      return fetchEventRewardDeliveryRecords(supabase, notificationIds, memberIds);
    },
    updateWinnerNotificationRows(
      memberIds: readonly string[],
      values: {
        status: EventRewardWinnerNotificationStatus;
        sentAt: string | null;
        error: string | null;
      },
    ) {
      return updateEventRewardWinnerNotificationRows(supabase, drawId, memberIds, {
        notification_status: values.status,
        notification_sent_at: values.sentAt,
        notification_error: values.error,
      });
    },
    async persistNotificationOutcome(params: {
      status: EventRewardNotificationSendStatus;
      sentAt: string | null;
      notificationId: string | null;
      metadata: Record<string, unknown>;
      associationToken: string | null;
    }) {
      let update = supabase.from("event_reward_draws").update({
        status: params.status, sent_at: params.sentAt, sent_notification_id: params.notificationId,
        metadata: params.metadata,
      }).eq("id", drawId);
      update = params.associationToken
        ? update.eq("metadata->>notificationCampaignAttemptToken", params.associationToken)
        : update.eq("updated_at", drawRow.updated_at);
      const { data, error } = await update.select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!hasDrawWriteReceipt(data, drawId)) throw new EventRewardSafeError("다른 발송 작업이 진행 중입니다. 결과를 새로고침해 주세요.");
    },
    async associateNotificationCampaign(params: {
      notificationId: string;
      metadata: Record<string, unknown>;
      attemptedAt: string;
    }) {
      const { data, error } = await supabase.from("event_reward_draws").update({
        sent_notification_id: params.notificationId, metadata: params.metadata,
        updated_at: params.attemptedAt,
      }).eq("id", drawId).eq("updated_at", drawRow.updated_at).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!hasDrawWriteReceipt(data, drawId)) throw new EventRewardSafeError("다른 발송 작업이 진행 중입니다. 결과를 새로고침해 주세요.");
    },
  };
}
