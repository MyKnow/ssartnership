import { createHash, randomBytes } from "node:crypto";
import { getMemberNotificationPreferences } from "@/lib/notification-preferences";
import { fetchMemberVisibleReviewCountInRange } from "@/lib/partner-counts";
import { collectPagedRows } from "@/lib/log-insights/paging";
import { getPolicyDocumentByKind } from "@/lib/policy-documents";
import { getPushPreferencesOrDefault } from "@/lib/push";
import {
  sendAdminNotificationCampaign,
  type AdminNotificationComposerInput,
} from "@/lib/admin-notification-ops";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { EventCampaign, EventConditionKey } from "@/lib/promotions/catalog";

export type EventRewardConditionStatus = "received" | "missing";

export type EventRewardConditionSummary = {
  key: EventConditionKey;
  status: EventRewardConditionStatus;
  earnedTickets: number;
  currentCount?: number;
};

export type EventRewardSummary = {
  authenticated: boolean;
  totalTickets: number;
  conditions: EventRewardConditionSummary[];
};

type MemberRewardSnapshot = {
  createdAt: string | null;
  preferences: {
    enabled: boolean;
    mmEnabled: boolean;
    marketingEnabled: boolean;
  } | null;
  reviewCount: number;
};

export type EventRewardAdminMemberInput = {
  id: string;
  displayName: string | null;
  mmUsername: string;
  year: number;
  campus: string | null;
  createdAt: string | null;
  preferences: MemberRewardSnapshot["preferences"];
  reviewCount: number;
};

export type EventRewardAdminMemberRow = EventRewardAdminMemberInput & {
  totalTickets: number;
  conditions: EventRewardConditionSummary[];
};

export type EventRewardAdminOverview = {
  memberCount: number;
  totalTickets: number;
  reviewCount: number;
  conditionCounts: Record<EventConditionKey, number>;
  members: EventRewardAdminMemberRow[];
};

export type EventRewardBeforeStatus = EventRewardConditionStatus | "unknown";

export type EventRewardComparisonMemberRow = EventRewardAdminMemberRow & {
  existedBeforeEvent: boolean;
  joinedDuringEvent: boolean;
  beforeKnownTickets: number;
  afterTickets: number;
  knownTicketDelta: number;
  beforeConditions: Partial<Record<EventConditionKey, EventRewardBeforeStatus>>;
};

export type EventRewardComparisonOverview = {
  beforeAt: string;
  afterAt: string;
  memberCount: number;
  totalBeforeKnownTickets: number;
  totalAfterTickets: number;
  totalKnownTicketDelta: number;
  members: EventRewardComparisonMemberRow[];
};

export type EventRewardDrawRequest = {
  winnerCount: number;
  seed: string;
  googleFormUrl: string;
};

export type EventRewardDrawWinner = {
  rank: number;
  memberId: string;
  displayName: string | null;
  mmUsername: string;
  year: number;
  campus: string | null;
  ticketCount: number;
};

export type EventRewardDrawPlan = {
  seed: string;
  winnerCount: number;
  candidateCount: number;
  totalTickets: number;
  winners: EventRewardDrawWinner[];
};

type MemberRow = {
  id: string;
  display_name: string | null;
  mm_username: string | null;
  year: number | null;
  campus: string | null;
  marketing_policy_version: number | null;
  created_at: string | null;
};

type PreferenceRow = {
  member_id: string | null;
  enabled: boolean | null;
  mm_enabled: boolean | null;
};

type ReviewRow = {
  member_id: string | null;
};

export type EventRewardDrawStatus =
  | "draft"
  | "finalized"
  | "sent"
  | "partial_failed"
  | "failed";

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
  notification_status: "pending" | "sent" | "partial_failed" | "failed" | "skipped";
  notification_sent_at: string | null;
  notification_error: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRewardStoredWinner = {
  id: string;
  drawId: string;
  eventSlug: string;
  memberId: string;
  rank: number;
  ticketCount: number;
  displayName: string | null;
  mmUsername: string;
  year: number;
  campus: string | null;
  notificationStatus: EventRewardWinnerRow["notification_status"];
  notificationSentAt: string | null;
  notificationError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRewardStoredDraw = {
  id: string;
  eventSlug: string;
  status: EventRewardDrawStatus;
  seed: string;
  winnerCount: number;
  candidateCount: number;
  totalTickets: number;
  googleFormUrl: string;
  guidePath: string;
  sentNotificationId: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  finalizedAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  winners: EventRewardStoredWinner[];
};

export type EventRewardNotificationSendStatus = "sent" | "partial_failed" | "failed";

export const EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT = "알림 발송";

function assertEventRewardQuerySucceeded(error: unknown, label: string) {
  if (!error) {
    return;
  }
  const message = error instanceof Error && error.message ? error.message : String(error);
  throw new Error(`이벤트 추첨권 현황 조회에 실패했습니다. (${label}: ${message})`);
}

function isJoinedByCampaignEnd(value: string | null, campaign: EventCampaign) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= new Date(campaign.endsAt).getTime();
}

function isJoinedByCampaignStart(value: string | null, campaign: EventCampaign) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= new Date(campaign.startsAt).getTime();
}

function isJoinedDuringCampaign(value: string | null, campaign: EventCampaign) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  return Number.isFinite(time) && time > startsAt && time <= endsAt;
}

export function calculateEventRewardConditions(
  campaign: EventCampaign,
  snapshot: MemberRewardSnapshot,
): EventRewardConditionSummary[] {
  return campaign.conditions.map<EventRewardConditionSummary>((condition) => {
    if (condition.key === "signup") {
      const received = isJoinedByCampaignEnd(snapshot.createdAt, campaign);
      return {
        key: condition.key,
        status: received ? "received" : "missing",
        earnedTickets: received ? condition.tickets : 0,
      };
    }

    if (condition.key === "mm") {
      const received = Boolean(snapshot.preferences?.mmEnabled);
      return {
        key: condition.key,
        status: received ? "received" : "missing",
        earnedTickets: received ? condition.tickets : 0,
      };
    }

    if (condition.key === "push") {
      const received = Boolean(snapshot.preferences?.enabled);
      return {
        key: condition.key,
        status: received ? "received" : "missing",
        earnedTickets: received ? condition.tickets : 0,
      };
    }

    if (condition.key === "marketing") {
      const received = Boolean(snapshot.preferences?.marketingEnabled);
      return {
        key: condition.key,
        status: received ? "received" : "missing",
        earnedTickets: received ? condition.tickets : 0,
      };
    }

    const reviewCount = snapshot.reviewCount;
    return {
      key: condition.key,
      status: reviewCount > 0 ? "received" : "missing",
      earnedTickets: reviewCount * condition.tickets,
      currentCount: reviewCount,
    };
  });
}

export function sumEventRewardTickets(
  conditions: readonly EventRewardConditionSummary[],
) {
  return conditions.reduce((sum, condition) => sum + condition.earnedTickets, 0);
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

export function buildEventRewardAdminOverview(
  campaign: EventCampaign,
  members: readonly EventRewardAdminMemberInput[],
): EventRewardAdminOverview {
  const conditionCounts = Object.fromEntries(
    campaign.conditions.map((condition) => [condition.key, 0]),
  ) as Record<EventConditionKey, number>;

  const rows = members.map<EventRewardAdminMemberRow>((member) => {
    const conditions = calculateEventRewardConditions(campaign, {
      createdAt: member.createdAt,
      preferences: member.preferences,
      reviewCount: member.reviewCount,
    });
    for (const condition of conditions) {
      if (condition.status === "received") {
        conditionCounts[condition.key] = (conditionCounts[condition.key] ?? 0) + 1;
      }
    }
    return {
      ...member,
      totalTickets: sumEventRewardTickets(conditions),
      conditions,
    };
  });

  return {
    memberCount: rows.length,
    totalTickets: rows.reduce((sum, row) => sum + row.totalTickets, 0),
    reviewCount: rows.reduce((sum, row) => sum + row.reviewCount, 0),
    conditionCounts,
    members: rows.sort((a, b) => {
      if (b.totalTickets !== a.totalTickets) {
        return b.totalTickets - a.totalTickets;
      }
      return (a.displayName ?? a.mmUsername).localeCompare(
        b.displayName ?? b.mmUsername,
        "ko",
      );
    }),
  };
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function conditionStatusLabel(
  row: EventRewardAdminMemberRow,
  key: EventConditionKey,
) {
  const condition = row.conditions.find((item) => item.key === key);
  if (key === "review") {
    return String(condition?.currentCount ?? 0);
  }
  return condition?.status === "received" ? "완료" : "미완료";
}

function beforeConditionStatusLabel(value: EventRewardBeforeStatus | undefined) {
  if (value === "received") {
    return "완료";
  }
  if (value === "missing") {
    return "미완료";
  }
  return "확인불가";
}

export function createEventRewardCsv(overview: EventRewardAdminOverview) {
  const headers = [
    "이름",
    "MM ID",
    "기수",
    "캠퍼스",
    "총 추첨권",
    "signup",
    "mm",
    "push",
    "marketing",
    "review",
  ];
  const rows = overview.members.map((member) => [
    member.displayName ?? "",
    member.mmUsername,
    member.year,
    member.campus ?? "",
    member.totalTickets,
    conditionStatusLabel(member, "signup"),
    conditionStatusLabel(member, "mm"),
    conditionStatusLabel(member, "push"),
    conditionStatusLabel(member, "marketing"),
    conditionStatusLabel(member, "review"),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\n")}`;
}

export function buildEventRewardComparisonOverview(
  campaign: EventCampaign,
  members: readonly EventRewardAdminMemberInput[],
): EventRewardComparisonOverview {
  const adminOverview = buildEventRewardAdminOverview(campaign, members);
  const rows = adminOverview.members.map<EventRewardComparisonMemberRow>((member) => {
    const signupCondition = campaign.conditions.find((condition) => condition.key === "signup");
    const existedBeforeEvent = isJoinedByCampaignStart(member.createdAt, campaign);
    const joinedDuringEvent = isJoinedDuringCampaign(member.createdAt, campaign);
    const beforeConditions: Partial<Record<EventConditionKey, EventRewardBeforeStatus>> = {
      signup: existedBeforeEvent ? "received" : "missing",
      mm: "unknown",
      push: "unknown",
      marketing: "unknown",
    };
    const beforeKnownTickets =
      beforeConditions.signup === "received" ? signupCondition?.tickets ?? 0 : 0;
    return {
      ...member,
      existedBeforeEvent,
      joinedDuringEvent,
      beforeKnownTickets,
      afterTickets: member.totalTickets,
      knownTicketDelta: member.totalTickets - beforeKnownTickets,
      beforeConditions,
    };
  });

  return {
    beforeAt: campaign.startsAt,
    afterAt: campaign.endsAt,
    memberCount: rows.length,
    totalBeforeKnownTickets: rows.reduce((sum, row) => sum + row.beforeKnownTickets, 0),
    totalAfterTickets: rows.reduce((sum, row) => sum + row.afterTickets, 0),
    totalKnownTicketDelta: rows.reduce((sum, row) => sum + row.knownTicketDelta, 0),
    members: rows,
  };
}

export function createEventRewardComparisonCsv(
  overview: EventRewardComparisonOverview,
) {
  const headers = [
    "이름",
    "MM ID",
    "기수",
    "캠퍼스",
    "이벤트 전 가입",
    "이벤트 중 가입",
    "Before 추첨권(확인가능)",
    "After 추첨권",
    "증감(확인가능)",
    "before_signup",
    "before_mm",
    "before_push",
    "before_marketing",
    "after_signup",
    "after_mm",
    "after_push",
    "after_marketing",
    "after_review",
  ];
  const rows = overview.members.map((member) => [
    member.displayName ?? "",
    member.mmUsername,
    member.year,
    member.campus ?? "",
    member.existedBeforeEvent ? "Y" : "N",
    member.joinedDuringEvent ? "Y" : "N",
    member.beforeKnownTickets,
    member.afterTickets,
    member.knownTicketDelta,
    beforeConditionStatusLabel(member.beforeConditions.signup),
    beforeConditionStatusLabel(member.beforeConditions.mm),
    beforeConditionStatusLabel(member.beforeConditions.push),
    beforeConditionStatusLabel(member.beforeConditions.marketing),
    conditionStatusLabel(member, "signup"),
    conditionStatusLabel(member, "mm"),
    conditionStatusLabel(member, "push"),
    conditionStatusLabel(member, "marketing"),
    conditionStatusLabel(member, "review"),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\n")}`;
}

function hashToIndex(seed: string, round: number, maxExclusive: number) {
  const digest = createHash("sha256")
    .update(`${seed}:${round}`)
    .digest();
  const value = digest.readUInt32BE(0);
  return value % maxExclusive;
}

export function normalizeEventRewardDrawRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
  googleFormUrl?: unknown;
}): EventRewardDrawRequest {
  const winnerCount = Number(input.winnerCount);
  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new Error("당첨 인원은 1명 이상이어야 합니다.");
  }

  const rawUrl = String(input.googleFormUrl ?? "").trim();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("구글폼 링크 형식을 확인해 주세요.");
  }
  const host = url.hostname.toLowerCase();
  const googleFormsHost =
    host === "forms.gle" ||
    (host === "docs.google.com" && url.pathname.startsWith("/forms/"));
  if (url.protocol !== "https:" || !googleFormsHost) {
    throw new Error("구글폼 HTTPS 링크만 사용할 수 있습니다.");
  }

  const seed = String(input.seed ?? "").trim() || randomBytes(16).toString("hex");
  return {
    winnerCount,
    seed,
    googleFormUrl: url.toString(),
  };
}

export function normalizeEventRewardWinnerNotificationRequest(input: {
  confirmationText?: unknown;
}) {
  const confirmationText =
    typeof input.confirmationText === "string" ? input.confirmationText.trim() : "";
  if (confirmationText !== EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT) {
    throw new Error(
      `확인 문구 '${EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}'를 정확히 입력해 주세요.`,
    );
  }
  return { confirmationText };
}

export function normalizeEventRewardTestNotificationRequest(input: {
  memberId?: unknown;
}) {
  const memberId = typeof input.memberId === "string" ? input.memberId.trim() : "";
  if (!memberId) {
    throw new Error("테스트 수신자를 선택해 주세요.");
  }
  return { memberId };
}

export function createEventRewardDrawPlan(
  overview: EventRewardAdminOverview,
  input: {
    winnerCount: number;
    seed?: string | null;
  },
): EventRewardDrawPlan {
  const seed = input.seed?.trim() || randomBytes(16).toString("hex");
  const candidates = overview.members
    .filter((member) => member.totalTickets > 0)
    .map((member) => ({ ...member }));

  if (candidates.length === 0) {
    throw new Error("추첨 가능한 후보가 없습니다.");
  }
  if (!Number.isInteger(input.winnerCount) || input.winnerCount <= 0) {
    throw new Error("당첨 인원은 1명 이상이어야 합니다.");
  }
  if (input.winnerCount > candidates.length) {
    throw new Error("당첨 인원은 추첨 가능한 후보 수를 초과할 수 없습니다.");
  }

  const totalTickets = candidates.reduce((sum, member) => sum + member.totalTickets, 0);
  const remaining = [...candidates];
  const winners: EventRewardDrawWinner[] = [];

  for (let round = 0; round < input.winnerCount; round += 1) {
    const remainingTickets = remaining.reduce((sum, member) => sum + member.totalTickets, 0);
    const pickedTicketIndex = hashToIndex(seed, round, remainingTickets);
    let cursor = 0;
    const pickedIndex = remaining.findIndex((member) => {
      cursor += member.totalTickets;
      return pickedTicketIndex < cursor;
    });
    const [winner] = remaining.splice(Math.max(0, pickedIndex), 1);
    if (!winner) {
      throw new Error("추첨 결과를 계산하지 못했습니다.");
    }
    winners.push({
      rank: round + 1,
      memberId: winner.id,
      displayName: winner.displayName,
      mmUsername: winner.mmUsername,
      year: winner.year,
      campus: winner.campus,
      ticketCount: winner.totalTickets,
    });
  }

  return {
    seed,
    winnerCount: input.winnerCount,
    candidateCount: candidates.length,
    totalTickets,
    winners,
  };
}

export function canViewEventRewardWinnerForm(params: {
  memberId?: string | null;
  winnerMemberIds: readonly string[];
}) {
  return Boolean(
    params.memberId && params.winnerMemberIds.includes(params.memberId),
  );
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
  marketingEnabled: boolean;
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
    marketingEnabled: params.marketingEnabled,
  };
}

async function fetchAllEventMembers(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const result = await collectPagedRows<MemberRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("members")
      .select("id,display_name,mm_username,year,campus,marketing_policy_version,created_at")
      .order("year", { ascending: false })
      .order("display_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    assertEventRewardQuerySucceeded(error, "members");
    return { rows: (data ?? []) as MemberRow[], error: false };
  });
  return result.rows;
}

async function fetchAllEventPreferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const result = await collectPagedRows<PreferenceRow>(null, async (from, to) => {
    const { data, error } = await supabase
      .from("push_preferences")
      .select("member_id,enabled,mm_enabled")
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
  const [members, preferences, reviewCounts] = await Promise.all([
    fetchAllEventMembers(supabase),
    fetchAllEventPreferences(supabase),
    fetchAllEventReviewCounts(supabase, campaign),
  ]);
  const activeMarketingPolicy = await getPolicyDocumentByKind("marketing").catch(
    () => null,
  );
  const preferenceMap = new Map(preferences.map((row) => [row.member_id ?? "", row]));

  return buildEventRewardAdminOverview(
    campaign,
    members.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      mmUsername: member.mm_username ?? "",
      year: member.year ?? 0,
      campus: member.campus,
      createdAt: member.created_at,
      preferences: normalizePreferences({
        row: preferenceMap.get(member.id),
        marketingEnabled: Boolean(
          activeMarketingPolicy &&
            member.marketing_policy_version === activeMarketingPolicy.version,
        ),
      }),
      reviewCount: reviewCounts.get(member.id) ?? 0,
    })),
  );
}

export async function getLatestEventRewardDrawWithWinners(eventSlug: string) {
  const supabase = getSupabaseAdminClient();
  const { data: draw, error: drawError } = await supabase
    .from("event_reward_draws")
    .select(
      "id,event_slug,status,seed,winner_count,candidate_count,total_tickets,google_form_url,guide_path,sent_notification_id,metadata,created_by_admin_id,created_at,finalized_at,sent_at,updated_at",
    )
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
    .select(
      "id,draw_id,event_slug,member_id,winner_rank,ticket_count,display_name,mm_username,year,campus,notification_status,notification_sent_at,notification_error,created_at,updated_at",
    )
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

export async function createStoredEventRewardDraw(params: {
  campaign: EventCampaign;
  request: EventRewardDrawRequest;
  createdByAdminId?: string | null;
}) {
  const overview = await getEventRewardAdminOverview(params.campaign);
  const plan = createEventRewardDrawPlan(overview, {
    winnerCount: params.request.winnerCount,
    seed: params.request.seed,
  });
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const guidePath = getEventRewardWinnerGuidePath(params.campaign.slug);
  const { data: draw, error: drawError } = await supabase
    .from("event_reward_draws")
    .insert({
      event_slug: params.campaign.slug,
      status: "finalized",
      seed: plan.seed,
      winner_count: plan.winnerCount,
      candidate_count: plan.candidateCount,
      total_tickets: plan.totalTickets,
      google_form_url: params.request.googleFormUrl,
      guide_path: guidePath,
      created_by_admin_id: params.createdByAdminId ?? null,
      finalized_at: now,
      metadata: {
        campaignTitle: params.campaign.title,
        campaignStartsAt: params.campaign.startsAt,
        campaignEndsAt: params.campaign.endsAt,
      },
    })
    .select(
      "id,event_slug,status,seed,winner_count,candidate_count,total_tickets,google_form_url,guide_path,sent_notification_id,metadata,created_by_admin_id,created_at,finalized_at,sent_at,updated_at",
    )
    .single();

  if (drawError) {
    if (drawError.message.includes("event_reward_draws_one_finalized_per_event")) {
      throw new Error("이미 확정된 추첨이 있습니다.");
    }
    throw new Error(drawError.message);
  }

  const winnerRows = plan.winners.map((winner) => ({
    draw_id: draw.id,
    event_slug: params.campaign.slug,
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
    .select(
      "id,draw_id,event_slug,member_id,winner_rank,ticket_count,display_name,mm_username,year,campus,notification_status,notification_sent_at,notification_error,created_at,updated_at",
    );
  if (winnerError) {
    throw new Error(winnerError.message);
  }

  return mapDrawRow(
    draw as EventRewardDrawRow,
    (winners ?? []) as EventRewardWinnerRow[],
  );
}

function drawNotificationStatus(params: {
  targeted: number;
  sent: number;
  failed: number;
}): EventRewardNotificationSendStatus {
  if (params.targeted === 0) {
    return "failed";
  }
  if (params.sent === 0) {
    return "failed";
  }
  if (params.failed > 0 || params.sent < params.targeted) {
    return "partial_failed";
  }
  return "sent";
}

export function resolveEventRewardNotificationSentAt(
  status: EventRewardNotificationSendStatus,
  attemptedAt: string,
) {
  return status === "sent" ? attemptedAt : null;
}

export function isEventRewardNotificationSendComplete(
  status: EventRewardDrawStatus,
  sentAt: string | null,
) {
  return status === "sent" && Boolean(sentAt);
}

export function getEventRewardWinnerGuidePath(eventSlug: string) {
  return `/events/${eventSlug}/winner-form`;
}

export function buildEventRewardWinnerNotificationInput(params: {
  guidePath: string;
  memberIds: readonly string[];
  confirmationText: string;
  testMode?: boolean;
}): AdminNotificationComposerInput {
  const memberIds = Array.from(
    new Set(params.memberIds.map((memberId) => memberId.trim()).filter(Boolean)),
  );
  if (memberIds.length === 0) {
    throw new Error("발송 대상 당첨자를 찾을 수 없습니다.");
  }

  const title = params.testMode
    ? "[테스트] 싸트너십 추첨권 이벤트 당첨 안내"
    : "싸트너십 추첨권 이벤트 당첨 안내";
  const body = params.testMode
    ? "운영 테스트 발송입니다. 실제 당첨 안내가 아니며, 구글폼은 로그인한 당첨자에게만 노출됩니다."
    : "축하합니다. 기프티콘 발송 정보 입력을 위해 당첨 안내 페이지에서 구글폼을 확인해 주세요.";

  return {
    notificationType: "announcement",
    title,
    body,
    url: params.guidePath,
    audience: {
      scope: "member",
      memberIds,
    },
    channels: {
      in_app: true,
      push: true,
      mm: true,
    },
    confirmationText: params.confirmationText,
  };
}

async function getEventRewardDrawRowForNotification(
  drawId: string,
  eventSlug?: string,
) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("event_reward_draws")
    .select(
      "id,event_slug,status,seed,winner_count,candidate_count,total_tickets,google_form_url,guide_path,sent_notification_id,metadata,created_by_admin_id,created_at,finalized_at,sent_at,updated_at",
    )
    .eq("id", drawId);
  if (eventSlug) {
    query = query.eq("event_slug", eventSlug);
  }
  const { data: drawRow, error: drawError } = await query.maybeSingle();
  if (drawError) {
    throw new Error(drawError.message);
  }
  if (!drawRow) {
    throw new Error("추첨 결과를 찾을 수 없습니다.");
  }
  return { supabase, drawRow: drawRow as EventRewardDrawRow };
}

export async function sendEventRewardWinnerNotifications(
  drawId: string,
  input: { confirmationText?: unknown; eventSlug?: string },
) {
  const request = normalizeEventRewardWinnerNotificationRequest(input);
  const { supabase, drawRow } = await getEventRewardDrawRowForNotification(
    drawId,
    input.eventSlug,
  );
  if (
    isEventRewardNotificationSendComplete(
      drawRow.status as EventRewardDrawStatus,
      drawRow.sent_at as string | null,
    )
  ) {
    throw new Error("이미 당첨 안내를 발송했습니다.");
  }

  const { data: winnerRows, error: winnerError } = await supabase
    .from("event_reward_winners")
    .select(
      "id,draw_id,event_slug,member_id,winner_rank,ticket_count,display_name,mm_username,year,campus,notification_status,notification_sent_at,notification_error,created_at,updated_at",
    )
    .eq("draw_id", drawId)
    .order("winner_rank", { ascending: true });
  if (winnerError) {
    throw new Error(winnerError.message);
  }

  const winners = (winnerRows ?? []) as EventRewardWinnerRow[];
  const memberIds = winners.map((winner) => winner.member_id);
  if (memberIds.length === 0) {
    throw new Error("당첨자가 없습니다.");
  }

  const result = await sendAdminNotificationCampaign(
    buildEventRewardWinnerNotificationInput({
      guidePath: drawRow.guide_path,
      memberIds,
      confirmationText: request.confirmationText,
    }),
  );

  const aggregate = Object.values(result.channelResults).reduce(
    (accumulator, channel) => ({
      targeted: accumulator.targeted + channel.targeted,
      sent: accumulator.sent + channel.sent,
      failed: accumulator.failed + channel.failed,
    }),
    { targeted: 0, sent: 0, failed: 0 },
  );
  const status = drawNotificationStatus(aggregate);
  const attemptedAt = new Date().toISOString();
  const sentAt = resolveEventRewardNotificationSentAt(status, attemptedAt);
  const errorMessage = result.warnings.length > 0 ? result.warnings.join("\n") : null;

  const { error: updateDrawError } = await supabase
    .from("event_reward_draws")
    .update({
      status,
      sent_notification_id: result.notificationId,
      sent_at: sentAt,
      metadata: {
        ...(drawRow.metadata ?? {}),
        channelResults: result.channelResults,
        lastNotificationAttemptedAt: attemptedAt,
        warnings: result.warnings,
      },
    })
    .eq("id", drawId);
  if (updateDrawError) {
    throw new Error(updateDrawError.message);
  }

  const { error: updateWinnerError } = await supabase
    .from("event_reward_winners")
    .update({
      notification_status: status,
      notification_sent_at: sentAt,
      notification_error: errorMessage,
    })
    .eq("draw_id", drawId);
  if (updateWinnerError) {
    throw new Error(updateWinnerError.message);
  }

  return {
    status,
    notificationId: result.notificationId,
    channelResults: result.channelResults,
    warnings: result.warnings,
  };
}

export async function sendEventRewardWinnerTestNotification(
  drawId: string | null,
  input: { memberId?: unknown; eventSlug?: string },
) {
  const request = normalizeEventRewardTestNotificationRequest(input);
  const guidePath = drawId
    ? (
        await getEventRewardDrawRowForNotification(
          drawId,
          input.eventSlug,
        )
      ).drawRow.guide_path
    : getEventRewardWinnerGuidePath(input.eventSlug ?? "signup-reward");

  const result = await sendAdminNotificationCampaign(
    buildEventRewardWinnerNotificationInput({
      guidePath,
      memberIds: [request.memberId],
      confirmationText: EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT,
      testMode: true,
    }),
  );

  return {
    status: drawNotificationStatus(
      Object.values(result.channelResults).reduce(
        (accumulator, channel) => ({
          targeted: accumulator.targeted + channel.targeted,
          sent: accumulator.sent + channel.sent,
          failed: accumulator.failed + channel.failed,
        }),
        { targeted: 0, sent: 0, failed: 0 },
      ),
    ),
    notificationId: result.notificationId,
    channelResults: result.channelResults,
    warnings: result.warnings,
  };
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
