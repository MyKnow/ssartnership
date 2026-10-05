import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getEffectiveMarketingConsentMemberIds,
  hasEffectiveMarketingConsent,
} from "../src/lib/notifications/marketing-consent.ts";
import { resolveAdminNotificationMemberChannelReasons } from "../src/lib/admin-notification-ops-eligibility.ts";
import { assertAudiencePushPayloadType } from "../src/lib/push/payloads.ts";
import { PushError } from "../src/lib/push/types.ts";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const enabledPreference = {
  enabled: true,
  announcementEnabled: true,
  newPartnerEnabled: true,
  expiringPartnerEnabled: true,
  reviewEnabled: true,
  mmEnabled: true,
  marketingEnabled: true,
};

test("마케팅 수신 자격은 활성 정책 동의와 현재 수신 설정을 모두 요구한다", () => {
  assert.equal(
    hasEffectiveMarketingConsent({
      hasActiveMarketingPolicy: true,
      hasCurrentPolicyConsent: true,
      marketingEnabled: true,
    }),
    true,
  );
  for (const input of [
    // 동의 후 철회: 동의 행은 감사 증적으로 남고 설정만 꺼진다.
    { hasActiveMarketingPolicy: true, hasCurrentPolicyConsent: true, marketingEnabled: false },
    // 설정 행 없음
    { hasActiveMarketingPolicy: true, hasCurrentPolicyConsent: true, marketingEnabled: null },
    { hasActiveMarketingPolicy: true, hasCurrentPolicyConsent: true, marketingEnabled: undefined },
    // 현재 정책 버전에 대한 동의 없음
    { hasActiveMarketingPolicy: true, hasCurrentPolicyConsent: false, marketingEnabled: true },
    // 활성 정책 없음
    { hasActiveMarketingPolicy: false, hasCurrentPolicyConsent: true, marketingEnabled: true },
  ]) {
    assert.equal(hasEffectiveMarketingConsent(input), false, JSON.stringify(input));
  }
});

test("회원 집합 판정은 수신을 철회했거나 설정 행이 없는 회원을 제외한다", () => {
  const effective = getEffectiveMarketingConsentMemberIds(
    new Set(["consented", "withdrawn", "no-preference-row"]),
    [
      { member_id: "consented", marketing_enabled: true },
      { member_id: "withdrawn", marketing_enabled: false },
      { member_id: "enabled-without-consent", marketing_enabled: true },
      { member_id: null, marketing_enabled: true },
    ],
  );

  assert.deepEqual([...effective], ["consented"]);
});

test("B22 회귀: 동의 기록이 남은 철회 회원은 마케팅 캠페인의 모든 채널에서 제외된다", () => {
  const reasons = resolveAdminNotificationMemberChannelReasons({
    notificationType: "marketing",
    preference: { ...enabledPreference, marketingEnabled: false },
    hasActiveMarketingPolicy: true,
    hasCurrentMarketingPolicyConsent: true,
    activePushSubscriptionCount: 2,
    hasMattermostUser: true,
  });

  assert.deepEqual(reasons, {
    in_app: "marketing_not_consented",
    push: "marketing_not_consented",
    mm: "marketing_not_consented",
  });
});

test("동의와 수신 설정이 모두 켜진 회원만 마케팅 캠페인 대상이 된다", () => {
  assert.deepEqual(
    resolveAdminNotificationMemberChannelReasons({
      notificationType: "marketing",
      preference: enabledPreference,
      hasActiveMarketingPolicy: true,
      hasCurrentMarketingPolicyConsent: true,
      activePushSubscriptionCount: 1,
      hasMattermostUser: true,
    }),
    {},
  );

  assert.deepEqual(
    resolveAdminNotificationMemberChannelReasons({
      notificationType: "marketing",
      preference: enabledPreference,
      hasActiveMarketingPolicy: true,
      hasCurrentMarketingPolicyConsent: false,
      activePushSubscriptionCount: 1,
      hasMattermostUser: true,
    }).in_app,
    "marketing_not_consented",
  );
});

test("운영 공지는 마케팅 수신 설정과 무관하게 채널 설정으로만 판정한다", () => {
  assert.deepEqual(
    resolveAdminNotificationMemberChannelReasons({
      notificationType: "announcement",
      preference: { ...enabledPreference, marketingEnabled: false, mmEnabled: false },
      hasActiveMarketingPolicy: false,
      hasCurrentMarketingPolicyConsent: false,
      activePushSubscriptionCount: 0,
      hasMattermostUser: false,
    }),
    { push: "no_push_subscription", mm: "mm_disabled" },
  );

  assert.deepEqual(
    resolveAdminNotificationMemberChannelReasons({
      notificationType: "new_partner",
      preference: { ...enabledPreference, newPartnerEnabled: false },
      hasActiveMarketingPolicy: true,
      hasCurrentMarketingPolicyConsent: true,
      activePushSubscriptionCount: 1,
      hasMattermostUser: true,
    }),
    { in_app: "type_disabled", push: "type_disabled", mm: "type_disabled" },
  );
});

test("대상 전체 즉시 발송은 광고성 알림 유형을 거부한다", () => {
  assert.throws(
    () => assertAudiencePushPayloadType("marketing"),
    (error: unknown) =>
      error instanceof PushError && error.code === "invalid_request",
  );
  assert.doesNotThrow(() => assertAudiencePushPayloadType("announcement"));
});

test("마케팅 수신 판정 경로는 공용 predicate를 사용한다", () => {
  const operations = readSource("src/lib/admin-notification-ops.ts");
  assert.match(operations, /resolveAdminNotificationMemberChannelReasons\(/);
  assert.doesNotMatch(operations, /marketingEnabled: hasCurrentMarketingConsent/);

  const memberList = readSource("src/lib/admin-member-list.server.ts");
  assert.match(
    memberList,
    /import \{ getEffectiveMarketingConsentMemberIds \} from "@\/lib\/notifications\/marketing-consent"/,
  );

  const eventRewards = readSource("src/lib/promotions/event-rewards.ts");
  assert.match(eventRewards, /\.select\("member_id,enabled,mm_enabled,marketing_enabled"\)/);
  assert.match(eventRewards, /hasEffectiveMarketingConsent\(/);

  const memberPreferences = readSource("src/lib/notification-preferences.ts");
  assert.match(memberPreferences, /hasEffectiveMarketingConsent\(/);

  const send = readSource("src/lib/push/send.ts");
  assert.match(
    send,
    /assertAudiencePushPayloadType\(rawPayload\.type\);[\s\S]*resolveNotificationTemplate/,
  );
});
