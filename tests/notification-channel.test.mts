import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MEMBER_DELIVERY_TEMPLATE_CHANNELS,
  OPERATIONAL_DELIVERY_TEMPLATE_CHANNELS,
  toMemberDeliveryChannel,
  toMemberTemplateChannel,
  toOperationalTemplateChannel,
} from "../src/lib/notifications/channel.ts";
import { NOTIFICATION_CHANNELS } from "../src/lib/notifications/shared.ts";
import { NOTIFICATION_TEMPLATE_CHANNELS } from "../src/lib/notification-templates/catalog.ts";
import {
  ADMIN_NOTIFICATION_CHANNELS,
  PARTNER_NOTIFICATION_CHANNELS,
} from "../src/lib/partner-notification-routing.ts";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("회원 delivery 채널은 템플릿 채널과 왕복 변환된다", () => {
  assert.equal(toMemberTemplateChannel("mm"), "mattermost");
  assert.equal(toMemberTemplateChannel("in_app"), "in_app");
  assert.equal(toMemberTemplateChannel("push"), "push");
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal(toMemberDeliveryChannel(toMemberTemplateChannel(channel)), channel);
  }
  assert.equal(toMemberDeliveryChannel("email"), null);
});

test("운영 알림 portal 채널은 인앱 템플릿을 쓴다", () => {
  assert.equal(toOperationalTemplateChannel("portal"), "in_app");
  assert.equal(toOperationalTemplateChannel("push"), "push");
  assert.equal(toOperationalTemplateChannel("email"), "email");
});

test("변환표는 저장 채널 상수와 schema.sql check 제약을 모두 덮는다", () => {
  assert.deepEqual(
    Object.keys(MEMBER_DELIVERY_TEMPLATE_CHANNELS).sort(),
    [...NOTIFICATION_CHANNELS].sort(),
  );
  assert.deepEqual(
    Object.keys(OPERATIONAL_DELIVERY_TEMPLATE_CHANNELS).sort(),
    [...PARTNER_NOTIFICATION_CHANNELS].sort(),
  );
  for (const channel of ADMIN_NOTIFICATION_CHANNELS) {
    assert.ok(channel in OPERATIONAL_DELIVERY_TEMPLATE_CHANNELS, channel);
  }
  for (const templateChannel of [
    ...Object.values(MEMBER_DELIVERY_TEMPLATE_CHANNELS),
    ...Object.values(OPERATIONAL_DELIVERY_TEMPLATE_CHANNELS),
  ]) {
    assert.ok(
      (NOTIFICATION_TEMPLATE_CHANNELS as readonly string[]).includes(templateChannel),
      templateChannel,
    );
  }

  assert.match(schema, /admin_notification_deliveries_channel_check\s+check \(channel in \('portal', 'push'\)\)/);
  assert.match(
    schema,
    /partner_notification_deliveries_channel_check\s+check \(channel in \('portal', 'push', 'email'\)\)/,
  );
  assert.match(
    schema,
    /notification_templates_channel_check\s+check \(channel in \('email', 'mattermost', 'push', 'in_app'\)\)/,
  );
});
