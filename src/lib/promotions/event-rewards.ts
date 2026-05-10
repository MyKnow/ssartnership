import { getMemberNotificationPreferences } from "@/lib/notification-preferences";
import { fetchMemberVisibleReviewCountInRange } from "@/lib/partner-counts";
import { collectPagedRows } from "@/lib/log-insights/paging";
import { getPolicyDocumentByKind } from "@/lib/policy-documents";
import { getPushPreferencesOrDefault } from "@/lib/push";
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

function isJoinedByCampaignEnd(value: string | null, campaign: EventCampaign) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= new Date(campaign.endsAt).getTime();
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
      .range(from, to);
    return { rows: (data ?? []) as MemberRow[], error: Boolean(error) };
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
      .range(from, to);
    return { rows: (data ?? []) as PreferenceRow[], error: Boolean(error) };
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
      .range(from, to);
    return { rows: (data ?? []) as ReviewRow[], error: Boolean(error) };
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
