import {
  CAMPUS_SLUGS,
  getCampusBySlug,
  normalizeCampusSlugs,
  type CampusSlug,
} from "@/lib/campuses";
import { sendAdminNotificationCampaign } from "@/lib/admin-notification-ops";
import {
  createNewPartnerPayload,
  isPushConfigured,
  type PushAudience,
} from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type NewPartnerAudienceMember = {
  id: string;
  campus: string | null;
};

export type NewPartnerPushAudience = {
  audience: PushAudience;
  normalizedCampusSlugs: CampusSlug[];
  targetCampusLabels: string[];
  targetMemberIds: string[] | null;
};

export type CampusScopedNewPartnerNotificationResult =
  | {
      sent: true;
      audience: NewPartnerPushAudience;
      notificationId: string;
    }
  | {
      sent: false;
      reason: "no_campus" | "no_member";
      audience: null;
      notificationId: null;
    };

function getCampusDisplayValues(slugs: CampusSlug[]) {
  return Array.from(
    new Set(
      slugs.flatMap((slug) => {
        const campus = getCampusBySlug(slug);
        return campus ? [campus.label, campus.fullLabel] : [];
      }),
    ),
  );
}

function getCampusLabels(slugs: CampusSlug[]) {
  return slugs
    .map((slug) => getCampusBySlug(slug)?.label)
    .filter((label): label is string => Boolean(label));
}

function coversEveryCampus(slugs: CampusSlug[]) {
  return CAMPUS_SLUGS.every((slug) => slugs.includes(slug));
}

export function buildNewPartnerPushAudienceFromCampusMembers(
  campusSlugs: string[],
  members: NewPartnerAudienceMember[],
): NewPartnerPushAudience | null {
  const normalizedCampusSlugs = normalizeCampusSlugs(campusSlugs);
  if (normalizedCampusSlugs.length === 0) {
    return null;
  }

  const targetCampusLabels = getCampusLabels(normalizedCampusSlugs);
  if (coversEveryCampus(normalizedCampusSlugs)) {
    return {
      audience: { scope: "all" },
      normalizedCampusSlugs,
      targetCampusLabels,
      targetMemberIds: null,
    };
  }

  const targetCampusValues = new Set(getCampusDisplayValues(normalizedCampusSlugs));
  const targetMemberIds = Array.from(
    new Set(
      members
        .filter((member) => {
          const campus = member.campus?.trim();
          return Boolean(campus && targetCampusValues.has(campus));
        })
        .map((member) => member.id),
    ),
  );

  if (targetMemberIds.length === 0) {
    return null;
  }

  return {
    audience: {
      scope: "member",
      memberId: targetMemberIds[0],
      memberIds: targetMemberIds,
    },
    normalizedCampusSlugs,
    targetCampusLabels,
    targetMemberIds,
  };
}

export async function resolveNewPartnerPushAudience(
  campusSlugs: string[],
): Promise<NewPartnerPushAudience | null> {
  const normalizedCampusSlugs = normalizeCampusSlugs(campusSlugs);
  if (normalizedCampusSlugs.length === 0) {
    return null;
  }

  if (coversEveryCampus(normalizedCampusSlugs)) {
    return buildNewPartnerPushAudienceFromCampusMembers(normalizedCampusSlugs, []);
  }

  const targetCampusValues = getCampusDisplayValues(normalizedCampusSlugs);
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id,campus")
    .in("campus", targetCampusValues)
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error("신규 제휴 알림 대상을 불러오지 못했습니다.");
  }

  return buildNewPartnerPushAudienceFromCampusMembers(
    normalizedCampusSlugs,
    (data ?? []) as NewPartnerAudienceMember[],
  );
}

export async function sendCampusScopedNewPartnerNotification(params: {
  partnerId: string;
  name: string;
  location: string;
  categoryLabel?: string | null;
  campusSlugs: string[];
}): Promise<CampusScopedNewPartnerNotificationResult> {
  const audience = await resolveNewPartnerPushAudience(params.campusSlugs);
  if (!audience) {
    return {
      sent: false,
      reason: normalizeCampusSlugs(params.campusSlugs).length === 0 ? "no_campus" : "no_member",
      audience: null,
      notificationId: null,
    };
  }

  const notificationPayload = createNewPartnerPayload({
    partnerId: params.partnerId,
    name: params.name,
    location: params.location,
    categoryLabel: params.categoryLabel ?? null,
  });
  const result = await sendAdminNotificationCampaign(
    {
      notificationType: "new_partner",
      title: notificationPayload.title,
      body: notificationPayload.body,
      url: notificationPayload.url,
      audience: audience.audience,
      channels: {
        in_app: true,
        push: isPushConfigured(),
        mm: false,
      },
    },
    "automatic",
  );

  return {
    sent: true,
    audience,
    notificationId: result.notificationId,
  };
}
