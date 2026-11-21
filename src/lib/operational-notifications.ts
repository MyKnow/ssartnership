// Public compatibility facade. Audience orchestration remains explicit in its domain modules.
export {
  getAdminOperationalNotificationPreferences,
  getPartnerOperationalNotificationPreferences,
  upsertAdminOperationalNotificationPreferences,
  upsertPartnerOperationalNotificationPreferences,
} from "./operational-notifications/preferences";
export {
  upsertOperationalPushSubscription,
  deactivateOperationalPushSubscription,
  listOperationalPushSubscriptionDevices,
  countOperationalPushSubscriptionDevices,
} from "./operational-notifications/subscriptions";
export {
  OperationalNotificationPersistenceUncertainError,
} from "./operational-notifications/persistence";
export { createPartnerOperationalNotification } from "./operational-notifications/partner";
export { createAdminOperationalNotification } from "./operational-notifications/admin";
export {
  claimOperationalNotificationDedupe,
  releaseOperationalNotificationDedupe,
  createDedupedOperationalNotification,
} from "./operational-notifications/dedupe";
export type { OperationalNotificationDedupeInput } from "./operational-notifications/types";

import { createAdminOperationalNotification } from "./operational-notifications/admin";
import { createDedupedOperationalNotification } from "./operational-notifications/dedupe";

export async function notifyAdminsOfPartnerRegistrationRequest(input: {
  requestId: string;
  source: string;
  companyName: string;
  partnerName: string;
  requesterName: string;
  categoryLabel: string;
  location: string;
}) {
  return createDedupedOperationalNotification({
    dedupe: {
      dedupeKey: `partner-registration-request:${input.requestId}`,
      audience: "admin",
      notificationType: "partner_registration_request",
      targetId: input.requestId,
    },
    create: () =>
      createAdminOperationalNotification({
        type: "partner_registration_request",
        title: input.partnerName,
        body: `회사: ${input.companyName}\n카테고리: ${input.categoryLabel}\n위치: ${input.location}\n신청자: ${input.requesterName}`,
        targetUrl: "/admin/partner-registrations?status=pending",
        metadata: {
          partnerRegistrationRequestId: input.requestId,
          source: input.source,
        },
        templateContext: {
          kind: "admin_partner_registration_request",
          companyName: input.companyName,
          partnerName: input.partnerName,
          requesterName: input.requesterName,
          partnerCategory: input.categoryLabel,
          partnerLocation: input.location,
          requestUrl: "/admin/partner-registrations?status=pending",
        },
      }),
  });
}
