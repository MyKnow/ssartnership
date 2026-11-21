import type { EventCampaign, EventConditionKey } from "@/lib/promotions/catalog";
import type {
  EventRewardAdminMemberInput,
  EventRewardAdminMemberRow,
  EventRewardAdminOverview,
  EventRewardBeforeStatus,
  EventRewardComparisonMemberRow,
  EventRewardComparisonOverview,
  EventRewardConditionSummary,
  EventRewardMemberPreferences,
} from "@/lib/promotions/event-rewards-types";

export type MemberRewardSnapshot = {
  createdAt: string | null;
  preferences: EventRewardMemberPreferences;
  reviewCount: number;
};


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
