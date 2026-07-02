import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createExpiringPartnershipDedupeKey,
  getExpiringPartnershipOffsets,
  resolveAdminNotificationChannels,
  resolvePartnerNotificationChannels,
} from "../src/lib/partner-notification-routing.ts";

describe("partner and admin notification routing", () => {
  it("resolves partner channels from requested channels and preferences", () => {
    assert.deepEqual(
      resolvePartnerNotificationChannels({
        requestedChannels: ["portal", "push", "email"],
        preferences: {
          enabled: true,
          portalEnabled: true,
          pushEnabled: false,
          emailEnabled: true,
          planEnabled: true,
          expiringPartnerEnabled: true,
          metricsEnabled: true,
        },
      }),
      ["portal", "email"],
    );

    assert.deepEqual(
      resolvePartnerNotificationChannels({
        requestedChannels: ["portal", "push"],
        preferences: null,
      }),
      ["portal", "push"],
    );
  });

  it("keeps important admin security alerts deliverable by default", () => {
    assert.deepEqual(
      resolveAdminNotificationChannels({
        type: "security_alert",
        requestedChannels: ["portal", "push"],
        preferences: {
          enabled: false,
          portalEnabled: false,
          pushEnabled: false,
          securityEnabled: false,
          partnerRequestEnabled: false,
          expiringPartnerEnabled: false,
        },
      }),
      ["portal"],
    );
  });

  it("uses fixed expiry offsets and stable dedupe keys", () => {
    assert.deepEqual(getExpiringPartnershipOffsets(), [30, 7, 1]);
    assert.equal(
      createExpiringPartnershipDedupeKey({
        audience: "partner",
        partnerId: "partner-1",
        daysBefore: 7,
        endDate: "2026-07-31",
      }),
      "expiring-partnership:partner:partner-1:7:2026-07-31",
    );
  });
});
