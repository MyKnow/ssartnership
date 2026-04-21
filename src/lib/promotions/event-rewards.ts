import { getMemberNotificationPreferences } from "@/lib/notification-preferences";
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

function isWithinCampaign(value: string | null, campaign: EventCampaign) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return (
    Number.isFinite(time) &&
    time >= new Date(campaign.startsAt).getTime() &&
    time <= new Date(campaign.endsAt).getTime()
  );
}

async function getMemberRewardSnapshot(
  memberId: string,
  campaign: EventCampaign,
): Promise<MemberRewardSnapshot> {
  const supabase = getSupabaseAdminClient();
  const [memberResult, preferences, reviewResult] = await Promise.all([
    supabase.from("members").select("created_at").eq("id", memberId).maybeSingle(),
    getMemberNotificationPreferences(memberId).catch(() => null),
    supabase
      .from("partner_reviews")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .is("deleted_at", null)
      .is("hidden_at", null)
      .gte("created_at", campaign.startsAt)
      .lte("created_at", campaign.endsAt),
  ]);

  return {
    createdAt:
      typeof memberResult.data?.created_at === "string" ? memberResult.data.created_at : null,
    preferences,
    reviewCount: reviewResult.count ?? 0,
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

  const conditions = params.campaign.conditions.map<EventRewardConditionSummary>((condition) => {
    if (condition.key === "signup") {
      const received = isWithinCampaign(snapshot.createdAt, params.campaign);
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

  return {
    authenticated: true,
    totalTickets: conditions.reduce((sum, condition) => sum + condition.earnedTickets, 0),
    conditions,
  };
}
