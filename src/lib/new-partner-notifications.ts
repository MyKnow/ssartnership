import {
  CAMPUS_SLUGS,
  getCampusBySlug,
  normalizeCampusSlugs,
  type CampusSlug,
} from "@/lib/campuses";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import { sendAdminNotificationCampaign } from "@/lib/admin-notification-ops";
import {
  createNewPartnerPayload,
  isPushConfigured,
  type PushAudience,
} from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { collectPagedRows } from "@/lib/supabase/paging";
import type { NotificationTemplateContext } from "@/lib/notification-templates/context";
import {
  getPartnerVisibilityState,
} from "@/lib/partner-visibility";
import { getKstDateString } from "@/lib/partner-utils";

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
      reason:
        | "no_campus"
        | "no_member"
        | "already_sent"
        | "already_processing";
      audience: null;
      notificationId: null;
    };

type PartnerPublicationNotificationRow = {
  id: string;
  name: string;
  location: string;
  campus_slugs?: string[] | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  period_start?: string | null;
  period_end?: string | null;
  map_url?: string | null;
  visibility?: string | null;
  categories?:
    | { label?: string | null }
    | Array<{ label?: string | null }>
    | null;
};

type PartnerPublicationNotificationStateRow = {
  partner_id: string;
  new_partner_notification_sent_at: string | null;
  new_partner_notification_processing_at?: string | null;
};

export type PendingPartnerPublicationNotificationResult = {
  processed: number;
  sent: number;
  skipped: number;
  failures: Array<{ partnerId: string; message: string }>;
};

const PUBLICATION_NOTIFICATION_CONCURRENCY = 4;
const PARTNER_PUBLICATION_NOTIFICATION_LEASE_MS = 15 * 60 * 1_000;

type PartnerPublicationNotificationLeaseOutcome =
  | "acquired"
  | "already_sent"
  | "already_processing";

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
  const supabase = getSupabaseAdminClient();
  const result = await collectPagedRows<NewPartnerAudienceMember>(
    null,
    async (from, to) => {
      const { data, error } = await supabase
        .from("members")
        .select("id,campus")
        .in("campus", targetCampusValues)
        .order("display_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) {
        throw new Error("신규 제휴 알림 대상을 불러오지 못했습니다.");
      }
      return {
        rows: (data ?? []) as NewPartnerAudienceMember[],
        error: false,
      };
    },
  );

  return buildNewPartnerPushAudienceFromCampusMembers(
    normalizedCampusSlugs,
    result.rows,
  );
}

export async function sendCampusScopedNewPartnerNotification(params: {
  partnerId: string;
  name: string;
  location: string;
  categoryLabel?: string | null;
  campusSlugs: string[];
  campusNames?: string | null;
  benefitSummary?: string | null;
  conditions?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  mapUrl?: string | null;
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
      templateContext: {
        kind: "new_partner",
        partnerName: params.name.trim(),
        partnerCategory: params.categoryLabel?.trim() || "제휴",
        partnerLocation: params.location.trim(),
        partnerUrl: notificationPayload.url,
        campusNames:
          params.campusNames?.trim() || audience.targetCampusLabels.join(", "),
        benefitSummary:
          params.benefitSummary?.trim() || "제휴처 상세 페이지에서 확인해 주세요.",
        conditions: params.conditions?.trim() || "별도 이용 조건을 확인해 주세요.",
        periodStart: params.periodStart?.trim() || "",
        periodEnd: params.periodEnd?.trim() || "",
        mapUrl: params.mapUrl?.trim() || "",
      } satisfies NotificationTemplateContext,
    },
    "automatic",
  );

  return {
    sent: true,
    audience,
    notificationId: result.notificationId,
  };
}

export async function recordNewPartnerNotificationSent(partnerId: string) {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdminClient()
    .from("partner_publication_notification_states")
    .upsert(
      {
        partner_id: partnerId,
        new_partner_notification_sent_at: now,
        new_partner_notification_processing_at: null,
        updated_at: now,
      },
      { onConflict: "partner_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearNewPartnerNotificationSent(partnerId: string) {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdminClient()
    .from("partner_publication_notification_states")
    .upsert(
      {
        partner_id: partnerId,
        new_partner_notification_sent_at: null,
        new_partner_notification_processing_at: null,
        updated_at: now,
      },
      { onConflict: "partner_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export function isPartnerPublicationNotificationLeaseExpired(
  processingAt: string | null | undefined,
  now = new Date(),
) {
  if (!processingAt) {
    return true;
  }

  const processingTime = new Date(processingAt).getTime();
  if (!Number.isFinite(processingTime)) {
    return true;
  }

  return processingTime <= now.getTime() - PARTNER_PUBLICATION_NOTIFICATION_LEASE_MS;
}

function isPartnerPublicationNotificationStateConflict(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "23505" ||
    error.message?.includes("duplicate key value violates unique constraint") === true
  );
}

async function claimPartnerPublicationNotificationLease(
  partnerId: string,
): Promise<PartnerPublicationNotificationLeaseOutcome> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(
    now.getTime() - PARTNER_PUBLICATION_NOTIFICATION_LEASE_MS,
  ).toISOString();

  const claimExistingLease = async (mode: "fresh" | "stale") => {
    let query = supabase
      .from("partner_publication_notification_states")
      .update({
        new_partner_notification_processing_at: nowIso,
        updated_at: nowIso,
      })
      .eq("partner_id", partnerId)
      .is("new_partner_notification_sent_at", null);

    query =
      mode === "fresh"
        ? query.is("new_partner_notification_processing_at", null)
        : query.lt("new_partner_notification_processing_at", staleBefore);

    const { data, error } = await query.select("partner_id").maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return Boolean(data?.partner_id);
  };

  if (await claimExistingLease("fresh")) {
    return "acquired";
  }
  if (await claimExistingLease("stale")) {
    return "acquired";
  }

  const { error: insertError } = await supabase
    .from("partner_publication_notification_states")
    .insert({
      partner_id: partnerId,
      new_partner_notification_sent_at: null,
      new_partner_notification_processing_at: nowIso,
      updated_at: nowIso,
    });

  if (!insertError) {
    return "acquired";
  }
  if (!isPartnerPublicationNotificationStateConflict(insertError)) {
    throw new Error(insertError.message);
  }

  const { data: stateRow, error: stateError } = await supabase
    .from("partner_publication_notification_states")
    .select(
      "partner_id,new_partner_notification_sent_at,new_partner_notification_processing_at",
    )
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (stateError) {
    throw new Error(stateError.message);
  }

  const state = stateRow as PartnerPublicationNotificationStateRow | null;
  if (state?.new_partner_notification_sent_at) {
    return "already_sent";
  }
  if (
    !state ||
    isPartnerPublicationNotificationLeaseExpired(
      state.new_partner_notification_processing_at,
      now,
    )
  ) {
    if (await claimExistingLease(state ? "stale" : "fresh")) {
      return "acquired";
    }
  }

  return "already_processing";
}

async function clearPartnerPublicationNotificationLease(partnerId: string) {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdminClient()
    .from("partner_publication_notification_states")
    .update({
      new_partner_notification_processing_at: null,
      updated_at: now,
    })
    .eq("partner_id", partnerId)
    .is("new_partner_notification_sent_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendAndRecordCampusScopedNewPartnerNotification(
  params: Parameters<typeof sendCampusScopedNewPartnerNotification>[0],
) {
  const lease = await claimPartnerPublicationNotificationLease(params.partnerId);
  if (lease !== "acquired") {
    return {
      sent: false,
      reason: lease,
      audience: null,
      notificationId: null,
    } satisfies CampusScopedNewPartnerNotificationResult;
  }

  try {
    const result = await sendCampusScopedNewPartnerNotification(params);
    if (result.sent) {
      await recordNewPartnerNotificationSent(params.partnerId);
      return result;
    }

    await clearPartnerPublicationNotificationLease(params.partnerId);
    return result;
  } catch (error) {
    await clearPartnerPublicationNotificationLease(params.partnerId);
    throw error;
  }
}

function getCategoryLabel(
  relation: PartnerPublicationNotificationRow["categories"],
) {
  if (Array.isArray(relation)) {
    return relation[0]?.label ?? null;
  }
  return relation?.label ?? null;
}

function isPublicState(
  partner: PartnerPublicationNotificationRow,
  today: string,
): partner is PartnerPublicationNotificationRow & { visibility: "public" } {
  return (
    getPartnerVisibilityState(
      "public",
      partner.period_start,
      partner.period_end,
      today,
    ) === "public"
  );
}

export async function runPendingPartnerPublicationNotifications(
  today?: string,
): Promise<PendingPartnerPublicationNotificationResult> {
  const resolvedToday = today ?? getKstDateString();
  const supabase = getSupabaseAdminClient();
  const { data: partnerRows, error: partnerError } = await supabase
    .from("partners")
    .select(
      "id,name,location,campus_slugs,benefits,conditions,period_start,period_end,map_url,visibility,categories(label)",
    )
    .eq("visibility", "public");

  if (partnerError) {
    throw new Error(partnerError.message);
  }

  const partners = (partnerRows ?? []) as PartnerPublicationNotificationRow[];
  if (partners.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failures: [] };
  }

  const { data: stateRows, error: stateError } = await supabase
    .from("partner_publication_notification_states")
    .select("partner_id,new_partner_notification_sent_at")
    .in("partner_id", partners.map((partner) => partner.id));

  if (stateError) {
    throw new Error(stateError.message);
  }

  const sentAtByPartnerId = new Map(
    ((stateRows ?? []) as PartnerPublicationNotificationStateRow[]).map((row) => [
      row.partner_id,
      row.new_partner_notification_sent_at,
    ]),
  );
  const pendingPartners = partners.filter(
    (partner) =>
      !sentAtByPartnerId.get(partner.id) && isPublicState(partner, resolvedToday),
  );
  const result: PendingPartnerPublicationNotificationResult = {
    processed: pendingPartners.length,
    sent: 0,
    skipped: 0,
    failures: [],
  };

  await forEachWithConcurrency(
    pendingPartners,
    PUBLICATION_NOTIFICATION_CONCURRENCY,
    async (partner) => {
      try {
        const notificationResult =
          await sendAndRecordCampusScopedNewPartnerNotification({
            partnerId: partner.id,
            name: partner.name,
            location: partner.location,
            categoryLabel: getCategoryLabel(partner.categories),
            campusSlugs: partner.campus_slugs ?? [],
            benefitSummary: (partner.benefits ?? []).join("\n"),
            conditions: (partner.conditions ?? []).join("\n"),
            periodStart: partner.period_start,
            periodEnd: partner.period_end,
            mapUrl: partner.map_url,
          });
        if (notificationResult.sent) {
          result.sent += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failures.push({
          partnerId: partner.id,
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        });
      }
    },
  );

  return result;
}
