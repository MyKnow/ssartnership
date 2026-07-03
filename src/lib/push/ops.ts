import {
  createAnnouncementPayload,
  createExpiringPartnerPayload,
  getPushDestinationLabel,
} from "./payloads.ts";
import { sendAdminNotificationCampaign } from "@/lib/admin-notification-ops";
import { isPushConfigured } from "./config.ts";
import { parsePushAudience } from "./audience.ts";
import { sendPushToAudience } from "./send.ts";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import {
  claimOperationalNotificationDedupe,
  createAdminOperationalNotification,
  createPartnerOperationalNotification,
} from "@/lib/operational-notifications";
import {
  createExpiringPartnershipDedupeKey,
} from "@/lib/partner-notification-routing";
import { getCompanyScopedPartnerServiceHref } from "@/lib/partner-portal-paths";
import type {
  DeliveryResult,
  PushAudience,
  PushPayload,
} from "./types.ts";
import { normalizePartnerVisibility } from "../partner-visibility.ts";

export type ExpiringPartnerTarget = {
  id: string;
  name: string;
  period_start?: string | null;
  period_end: string;
  visibility?: string | null;
  company_id?: string | null;
};

export type PushBatchSummary = {
  processedPartners: number;
  targeted: number;
  delivered: number;
  failed: number;
};

export type PushBatchFailure = {
  partnerId: string;
  name: string;
  message: string;
};

export type OperationalExpiringPartnerSummary = {
  processedPartners: number;
  adminCreated: number;
  partnerCreated: number;
  skippedDuplicates: number;
  skippedWithoutCompany: number;
  failed: number;
};

export type OperationalExpiringPartnerFailure = {
  audience: "admin" | "partner";
  partnerId: string;
  name: string;
  message: string;
};

export function getKstDateString(daysFromToday = 0, baseDate = new Date()) {
  const now = new Date(baseDate.getTime() + daysFromToday * 24 * 60 * 60 * 1000);
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPushOpsConfigured() {
  return isPushConfigured();
}

export function isSameOriginPushRequest(request: {
  headers: Pick<Headers, "get">;
  method?: string;
  url: string;
  nextUrl: { origin: string };
}) {
  return isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  });
}

export function filterExpiringPartnersForPush(
  partners: ExpiringPartnerTarget[],
  today: string,
) {
  return partners.filter((partner) => {
    return (
      (!partner.period_start || partner.period_start <= today) &&
      normalizePartnerVisibility(partner.visibility) !== "private"
    );
  });
}

export function mergePushBatchSummary(
  summary: PushBatchSummary,
  result: DeliveryResult,
) {
  return {
    processedPartners: summary.processedPartners,
    targeted: summary.targeted + result.targeted,
    delivered: summary.delivered + result.delivered,
    failed: summary.failed + result.failed,
  } satisfies PushBatchSummary;
}

export async function runExpiringPartnerPushBatch(
  partners: ExpiringPartnerTarget[],
) {
  let summary: PushBatchSummary = {
    processedPartners: partners.length,
    targeted: 0,
    delivered: 0,
    failed: 0,
  };
  const failures: PushBatchFailure[] = [];

  for (const partner of partners) {
    try {
      const payload = createExpiringPartnerPayload({
        partnerId: partner.id,
        name: partner.name,
        endDate: partner.period_end,
      });
      const result = await sendAdminNotificationCampaign(
        {
          notificationType: "expiring_partner",
          title: payload.title,
          body: payload.body,
          url: payload.url,
          audience: { scope: "all" },
          channels: {
            in_app: true,
            push: true,
            mm: false,
          },
        },
        "automatic",
      );
      summary = {
        ...summary,
        targeted:
          summary.targeted +
          result.channelResults.in_app.targeted +
          result.channelResults.push.targeted,
        delivered:
          summary.delivered +
          result.channelResults.in_app.sent +
          result.channelResults.push.sent,
        failed:
          summary.failed +
          result.channelResults.push.failed,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "만료 예정 알림 발송에 실패했습니다.";
      failures.push({
        partnerId: partner.id,
        name: partner.name,
        message,
      });
      summary = {
        ...summary,
        failed: summary.failed + 1,
      };
    }
  }

  return {
    ok: failures.length === 0,
    partialFailure: failures.length > 0,
    summary,
    failures,
  };
}

export async function runOperationalExpiringPartnerNotifications(
  partners: ExpiringPartnerTarget[],
  daysBefore: number,
) {
  const summary: OperationalExpiringPartnerSummary = {
    processedPartners: partners.length,
    adminCreated: 0,
    partnerCreated: 0,
    skippedDuplicates: 0,
    skippedWithoutCompany: 0,
    failed: 0,
  };
  const failures: OperationalExpiringPartnerFailure[] = [];

  for (const partner of partners) {
    const adminDedupeKey = createExpiringPartnershipDedupeKey({
      audience: "admin",
      partnerId: partner.id,
      daysBefore,
      endDate: partner.period_end,
    });
    const partnerDedupeKey = createExpiringPartnershipDedupeKey({
      audience: "partner",
      partnerId: partner.id,
      daysBefore,
      endDate: partner.period_end,
    });

    try {
      const shouldCreateAdminNotification = await claimOperationalNotificationDedupe({
        dedupeKey: adminDedupeKey,
        audience: "admin",
        notificationType: "expiring_partner",
        targetId: partner.id,
      });
      if (shouldCreateAdminNotification) {
        await createAdminOperationalNotification({
          type: "expiring_partner",
          title: `제휴 종료 ${daysBefore}일 전`,
          body: `${partner.name} 제휴가 ${partner.period_end}에 종료됩니다.`,
          targetUrl: `/admin/partners?query=${encodeURIComponent(partner.name)}`,
          metadata: {
            partnerId: partner.id,
            companyId: partner.company_id ?? null,
            daysBefore,
            endDate: partner.period_end,
          },
        });
        summary.adminCreated += 1;
      } else {
        summary.skippedDuplicates += 1;
      }
    } catch (error) {
      summary.failed += 1;
      failures.push({
        audience: "admin",
        partnerId: partner.id,
        name: partner.name,
        message:
          error instanceof Error
            ? error.message
            : "관리자 종료 임박 알림 생성에 실패했습니다.",
      });
    }

    if (!partner.company_id) {
      summary.skippedWithoutCompany += 1;
      continue;
    }

    try {
      const shouldCreatePartnerNotification = await claimOperationalNotificationDedupe({
        dedupeKey: partnerDedupeKey,
        audience: "partner",
        notificationType: "expiring_partner",
        targetId: partner.id,
      });
      if (shouldCreatePartnerNotification) {
        await createPartnerOperationalNotification({
          type: "expiring_partner",
          companyId: partner.company_id,
          title: `제휴 종료 ${daysBefore}일 전`,
          body: `${partner.name} 제휴가 ${partner.period_end}에 종료됩니다.`,
          targetUrl: getCompanyScopedPartnerServiceHref(partner.company_id, partner.id),
          metadata: {
            partnerId: partner.id,
            companyId: partner.company_id,
            daysBefore,
            endDate: partner.period_end,
          },
        });
        summary.partnerCreated += 1;
      } else {
        summary.skippedDuplicates += 1;
      }
    } catch (error) {
      summary.failed += 1;
      failures.push({
        audience: "partner",
        partnerId: partner.id,
        name: partner.name,
        message:
          error instanceof Error
            ? error.message
            : "파트너 종료 임박 알림 생성에 실패했습니다.",
      });
    }
  }

  return {
    ok: failures.length === 0,
    partialFailure: failures.length > 0,
    summary,
    failures,
  };
}

export function parsePushBroadcastRequest(body: {
  title?: string;
  body?: string;
  url?: string | null;
  audience?: unknown;
}) {
  const payload = createAnnouncementPayload({
    title: body.title ?? "",
    body: body.body ?? "",
    url: body.url ?? null,
  });
  const audience = parsePushAudience(body.audience);
  return { payload, audience };
}

export async function sendManualPushBroadcast(body: {
  title?: string;
  body?: string;
  url?: string | null;
  audience?: unknown;
}) {
  const { payload, audience } = parsePushBroadcastRequest(body);
  const result = await sendPushToAudience(payload, {
    source: "manual",
    audience,
  });
  return {
    payload,
    audience,
    result,
    destination: getPushDestinationLabel(payload.url),
  };
}

export function createPushAuditProperties(input: {
  payload: PushPayload;
  audience: PushAudience;
  result: DeliveryResult;
}) {
  return {
    type: input.payload.type,
    title: input.payload.title,
    hasUrl: Boolean(input.payload.url),
    audienceScope: input.audience.scope,
    audienceYear: "year" in input.audience ? input.audience.year : null,
    audienceCampus: "campus" in input.audience ? input.audience.campus : null,
    audienceMemberId: "memberId" in input.audience ? input.audience.memberId : null,
    destination: getPushDestinationLabel(input.payload.url),
    targeted: input.result.targeted,
    delivered: input.result.delivered,
    failed: input.result.failed,
  };
}
