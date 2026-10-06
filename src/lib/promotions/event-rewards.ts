import { createHash, randomBytes } from "node:crypto";
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
import {
  sendAdminNotificationCampaign,
  type AdminNotificationComposerInput,
} from "@/lib/admin-notification-ops";
import { toCsvCell } from "@/lib/csv";
import {
  buildDrawAuditSummary,
  type DrawAuditSummary,
  type DrawSeedSource,
} from "@/lib/draw-audit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { EventCampaign, EventConditionKey } from "@/lib/promotions/catalog";
import {
  getEventRewardNotificationAttemptIds,
  resolveEventRewardDrawDeliveryStatus,
  summarizeEventRewardWinnerDeliveries,
  type EventRewardDeliveryRecord,
} from "@/lib/promotions/event-reward-delivery";

import type {
  EventRewardAdminMemberInput,
  EventRewardAdminMemberRow,
  EventRewardAdminOverview,
  EventRewardBeforeStatus,
  EventRewardComparisonMemberRow,
  EventRewardComparisonOverview,
  EventRewardConditionSummary,
  EventRewardDrawPlan,
  EventRewardDrawPreviewRequest,
  EventRewardDrawRequest,
  EventRewardDrawStatus,
  EventRewardDrawWinner,
  EventRewardMemberPreferences,
  EventRewardNotificationSendStatus,
  EventRewardStoredDraw,
  EventRewardStoredWinner,
  EventRewardSummary,
  EventRewardValidationResult,
  EventRewardWinnerNotificationStatus,
} from "@/lib/promotions/event-rewards-types";

export type * from "@/lib/promotions/event-rewards-types";

type MemberRewardSnapshot = {
  createdAt: string | null;
  preferences: EventRewardMemberPreferences;
  reviewCount: number;
};


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

export const EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT = "알림 발송";

/**
 * Event pages whose tickets are drawn and notified from the admin console.
 * Every reward action and export must name one of these slugs explicitly; there
 * is no implicit default event.
 */
export const EVENT_REWARD_DRAW_EVENT_SLUGS = ["signup-reward"] as const;

export function supportsEventRewardDraw(slug: string | null | undefined) {
  return EVENT_REWARD_DRAW_EVENT_SLUGS.some((candidate) => candidate === slug);
}

/**
 * Reward failures whose message is written for admins and safe to show as-is.
 * Other errors may carry database text and must be replaced by a fallback.
 */
export class EventRewardSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventRewardSafeError";
  }
}

function requireEventRewardSlug(eventSlug: string | null | undefined) {
  const slug = typeof eventSlug === "string" ? eventSlug.trim() : "";
  if (!supportsEventRewardDraw(slug)) {
    throw new EventRewardSafeError("추첨 대상 이벤트를 확인해 주세요.");
  }
  return slug;
}

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
    .map((row) => row.map((value) => toCsvCell(value)).join(","))
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
    .map((row) => row.map((value) => toCsvCell(value)).join(","))
    .join("\n")}`;
}

function hashToIndex(seed: string, round: number, maxExclusive: number) {
  const digest = createHash("sha256")
    .update(`${seed}:${round}`)
    .digest();
  const value = digest.readUInt32BE(0);
  return value % maxExclusive;
}

function normalizeEventRewardWinnerCount(value: unknown) {
  const winnerCount = Number(value);
  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new Error("당첨 인원은 1명 이상이어야 합니다.");
  }
  return winnerCount;
}

function normalizeEventRewardDrawSeed(value: unknown) {
  return String(value ?? "").trim() || randomBytes(16).toString("hex");
}

function eventRewardValidationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function normalizeEventRewardDrawRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
  googleFormUrl?: unknown;
}): EventRewardDrawRequest {
  const winnerCount = normalizeEventRewardWinnerCount(input.winnerCount);

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

  const seed = normalizeEventRewardDrawSeed(input.seed);
  return {
    winnerCount,
    seed,
    googleFormUrl: url.toString(),
  };
}

export function parseEventRewardDrawRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
  googleFormUrl?: unknown;
}): EventRewardValidationResult<EventRewardDrawRequest> {
  try {
    return { ok: true, value: normalizeEventRewardDrawRequest(input) };
  } catch (error) {
    return {
      ok: false,
      message: eventRewardValidationErrorMessage(
        error,
        "추첨 확정 입력값을 확인해 주세요.",
      ),
    };
  }
}

export function normalizeEventRewardDrawPreviewRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
}): EventRewardDrawPreviewRequest {
  return {
    winnerCount: normalizeEventRewardWinnerCount(input.winnerCount),
    seed: normalizeEventRewardDrawSeed(input.seed),
  };
}

export function parseEventRewardDrawPreviewRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
}): EventRewardValidationResult<EventRewardDrawPreviewRequest> {
  try {
    return { ok: true, value: normalizeEventRewardDrawPreviewRequest(input) };
  } catch (error) {
    return {
      ok: false,
      message: eventRewardValidationErrorMessage(
        error,
        "테스트 추첨 입력값을 확인해 주세요.",
      ),
    };
  }
}

export function normalizeEventRewardWinnerNotificationRequest(input: {
  confirmationText?: unknown;
}) {
  const confirmationText =
    typeof input.confirmationText === "string" ? input.confirmationText.trim() : "";
  if (confirmationText !== EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT) {
    throw new EventRewardSafeError(
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
    throw new EventRewardSafeError("테스트 수신자를 선택해 주세요.");
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
    throw new EventRewardSafeError("추첨 가능한 후보가 없습니다.");
  }
  if (!Number.isInteger(input.winnerCount) || input.winnerCount <= 0) {
    throw new EventRewardSafeError("당첨 인원은 1명 이상이어야 합니다.");
  }
  if (input.winnerCount > candidates.length) {
    throw new EventRewardSafeError("당첨 인원은 추첨 가능한 후보 수를 초과할 수 없습니다.");
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

export const EVENT_REWARD_DRAW_ALGORITHM = "sha256-seeded-weighted-v1";

/**
 * Audit summary shared with the showcase draw (see draw-audit). The candidate
 * snapshot follows createEventRewardDrawPlan's candidate order, so the stored
 * seed plus this digest are enough to verify a reproduced draw.
 */
export function buildEventRewardDrawAudit(
  overview: EventRewardAdminOverview,
  seedSource: Extract<DrawSeedSource, "admin" | "generated">,
): DrawAuditSummary {
  return buildDrawAuditSummary({
    algorithm: EVENT_REWARD_DRAW_ALGORITHM,
    seedSource,
    entries: overview.members
      .filter((member) => member.totalTickets > 0)
      .map((member) => ({ id: member.id, weight: member.totalTickets })),
  });
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
    throw new EventRewardSafeError("발송 대상 당첨자를 찾을 수 없습니다.");
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

export async function sendEventRewardWinnerNotifications(
  drawId: string,
  input: { confirmationText?: unknown; eventSlug: string },
) {
  const eventSlug = requireEventRewardSlug(input.eventSlug);
  const request = normalizeEventRewardWinnerNotificationRequest(input);
  const { supabase, drawRow } = await getEventRewardDrawRowForNotification(
    drawId,
    eventSlug,
  );
  if (
    isEventRewardNotificationSendComplete(
      drawRow.status as EventRewardDrawStatus,
      drawRow.sent_at as string | null,
    )
  ) {
    throw new EventRewardSafeError("이미 당첨 안내를 발송했습니다.");
  }

  const { data: winnerRows, error: winnerError } = await supabase
    .from("event_reward_winners")
    .select(EVENT_REWARD_WINNER_SELECT)
    .eq("draw_id", drawId)
    .order("winner_rank", { ascending: true });
  if (winnerError) {
    throw new Error(winnerError.message);
  }

  const winners = (winnerRows ?? []) as EventRewardWinnerRow[];
  const memberIds = winners.map((winner) => winner.member_id);
  if (memberIds.length === 0) {
    throw new EventRewardSafeError("당첨자가 없습니다.");
  }

  const previousAttemptIds = getEventRewardNotificationAttemptIds(drawRow);
  const stableNotificationId = typeof drawRow.metadata?.notificationCampaignId === "string"
    ? drawRow.metadata.notificationCampaignId : null;
  const attemptedAt = new Date().toISOString();
  const readEvidence = async (ids: string[]) => {
    const records = await fetchEventRewardDeliveryRecords(supabase, ids, memberIds);
    if (!records) throw new EventRewardSafeError(
      "발송 이력을 확인하지 못해 중단했습니다. 발송 결과를 확인한 후 다시 시도해 주세요.",
    );
    return records;
  };
  const previousRecords = await readEvidence(previousAttemptIds);
  const previousOutcomes = summarizeEventRewardWinnerDeliveries(memberIds, previousRecords);
  const legacyIds = previousAttemptIds.filter((id) => id !== stableNotificationId);
  const legacyOutcomes = summarizeEventRewardWinnerDeliveries(
    memberIds, previousRecords
      .filter((record) => legacyIds.includes(record.notificationId))
      // Old push marked arbitrary provider errors "failed"; that legacy marker
      // cannot establish definitive rejection under the new retry contract.
      .map((record) => record.providerStatus === "failed"
        ? { ...record, providerStatus: null } : record),
  );
  // A missing legacy receipt cannot prove that the old, unclaimed sender never posted.
  const legacyUncertain = (memberId: string) => legacyIds.length > 0 && (
    !previousRecords.some((record) => record.memberId === memberId && legacyIds.includes(record.notificationId))
    || ["needs_reconciliation", "pending"].includes(legacyOutcomes.get(memberId) ?? "")
  );
  // A newly attached inbox can precede external delivery in a live campaign.
  // Recover its campaign disposition before treating inbox-only as complete.
  const stableInboxOnly = (memberId: string) => Boolean(stableNotificationId)
    && previousRecords.some((record) => record.memberId === memberId
      && record.notificationId === stableNotificationId && record.channel === "in_app" && record.status === "sent")
    && !previousRecords.some((record) => record.memberId === memberId && record.channel !== "in_app");
  const targetMemberIds = memberIds.filter((memberId) =>
    (previousOutcomes.get(memberId) !== "reached" || stableInboxOnly(memberId))
    && previousOutcomes.get(memberId) !== "needs_reconciliation"
    && !legacyUncertain(memberId),
  );
  let associationToken: string | null = null;
  let associationMetadata = { ...(drawRow.metadata ?? {}) };
  let attemptIds = previousAttemptIds;
  let targetCount = 0;
  let outcomes = previousOutcomes;

  const persistOutcome = async (notificationId: string | null, channelResults: unknown, warnings: string[]) => {
    const status = resolveEventRewardDrawDeliveryStatus(memberIds, outcomes);
    const sentAt = resolveEventRewardNotificationSentAt(status, attemptedAt);
    // Keep the terminal draw marker until last so a failed winner summary can
    // be repaired from delivery evidence without another provider call.
    for (const outcome of ["reached", "unreached", "pending", "needs_reconciliation"] as const) {
      await updateEventRewardWinnerNotificationRows(
        supabase, drawId, memberIds.filter((id) => outcomes.get(id) === outcome), {
          notification_status: outcome === "reached" ? "sent" : outcome === "unreached" ? "failed" : "pending",
          notification_sent_at: outcome === "reached" ? attemptedAt : null,
          notification_error: outcome === "reached" ? null : outcome === "unreached"
            ? "안내 도달을 확인하지 못했습니다. 알림 설정과 발송 결과를 확인해 주세요."
            : "발송 결과 확인이 필요하여 자동 재발송을 중단했습니다.",
        },
      );
    }
    let update = supabase.from("event_reward_draws").update({
      status, sent_at: sentAt, sent_notification_id: notificationId,
      metadata: {
        ...associationMetadata, channelResults, warnings,
        notificationAttemptIds: attemptIds,
        lastNotificationAttemptedAt: attemptedAt,
        lastNotificationTargetCount: targetCount,
      },
    }).eq("id", drawId);
    update = associationToken
      ? update.eq("metadata->>notificationCampaignAttemptToken", associationToken)
      : update.eq("updated_at", drawRow.updated_at);
    const { data, error } = await update.select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!hasDrawWriteReceipt(data, drawId)) throw new EventRewardSafeError("다른 발송 작업이 진행 중입니다. 결과를 새로고침해 주세요.");
    return status;
  };

  if (targetMemberIds.length === 0) {
    if (resolveEventRewardDrawDeliveryStatus(memberIds, previousOutcomes) !== "sent") {
      throw new EventRewardSafeError("발송 중이거나 결과 확인이 필요한 안내가 있어 재발송을 중단했습니다.");
    }
    const warnings = ["모든 당첨자에게 이미 안내가 전달되어 추가로 발송하지 않았습니다."];
    const status = await persistOutcome(drawRow.sent_notification_id, null, warnings);
    return { status, notificationId: drawRow.sent_notification_id, channelResults: null, warnings };
  }

  const result = await sendAdminNotificationCampaign(
    buildEventRewardWinnerNotificationInput({
      guidePath: drawRow.guide_path, memberIds: targetMemberIds,
      confirmationText: request.confirmationText,
    }),
    "manual",
    {
      drawId, eventSlug,
      beforeDelivery: async (claim) => {
        attemptIds = Array.from(new Set([...previousAttemptIds, claim.notificationId]));
        const records = await readEvidence(attemptIds);
        // The claim has just attached inbox receipts. They are not evidence that
        // the external portion of this pending attempt already ran.
        const externalOutcomes = summarizeEventRewardWinnerDeliveries(
          targetMemberIds, records.filter((record) => record.channel !== "in_app"),
        );
        const deliveryTargets = targetMemberIds.filter((id) =>
          ["unreached", "pending"].includes(externalOutcomes.get(id) ?? "unreached"),
        );
        associationToken = claim.attemptToken ?? `completed:${claim.notificationId}`;
        associationMetadata = {
          ...associationMetadata, notificationAttemptIds: attemptIds,
          notificationCampaignId: claim.notificationId,
          notificationCampaignAttemptToken: associationToken,
        };
        const { data, error } = await supabase.from("event_reward_draws").update({
          sent_notification_id: claim.notificationId, metadata: associationMetadata,
          updated_at: attemptedAt,
        }).eq("id", drawId).eq("updated_at", drawRow.updated_at).select("id").maybeSingle();
        if (error) throw new Error(error.message);
        if (!hasDrawWriteReceipt(data, drawId)) throw new EventRewardSafeError("다른 발송 작업이 진행 중입니다. 결과를 새로고침해 주세요.");
        targetCount = deliveryTargets.length;
        return deliveryTargets;
      },
      resolveDeliveryStatus: async (notificationId) => {
        outcomes = summarizeEventRewardWinnerDeliveries(memberIds, await readEvidence(
          Array.from(new Set([...attemptIds, notificationId])),
        ));
        return resolveEventRewardDrawDeliveryStatus(memberIds, outcomes);
      },
    },
  );
  if (result.campaignDisposition === "in_progress") {
    throw new EventRewardSafeError("같은 당첨 안내 발송이 이미 진행 중입니다. 잠시 후 결과를 확인해 주세요.");
  }
  outcomes = summarizeEventRewardWinnerDeliveries(memberIds, await readEvidence(attemptIds));
  const warnings = [...result.warnings];
  if ([...outcomes.values()].some((outcome) => outcome === "pending" || outcome === "needs_reconciliation")) {
    warnings.push("발송 결과 확인이 필요한 대상은 자동으로 재발송하지 않습니다.");
  }
  const status = await persistOutcome(result.notificationId, result.channelResults, warnings);
  return { status, notificationId: result.notificationId, channelResults: result.channelResults, warnings };
}

export async function sendEventRewardWinnerTestNotification(
  drawId: string | null,
  input: { memberId?: unknown; eventSlug: string },
) {
  const eventSlug = requireEventRewardSlug(input.eventSlug);
  const request = normalizeEventRewardTestNotificationRequest(input);
  const guidePath = drawId
    ? (
        await getEventRewardDrawRowForNotification(
          drawId,
          eventSlug,
        )
      ).drawRow.guide_path
    : getEventRewardWinnerGuidePath(eventSlug);

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
