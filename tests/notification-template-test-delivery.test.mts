import assert from "node:assert/strict";
import test from "node:test";

const deliveryModulePromise = import(
  "../src/lib/notification-templates/test-delivery.ts"
);

test("템플릿 테스트 변수는 실제 수신자 표시 이름과 안전한 테스트 값을 사용한다", async () => {
  const { getNotificationTemplateTestVariables } = await deliveryModulePromise;
  const variables = getNotificationTemplateTestVariables(
    {
      variables: [
        { name: "displayName", label: "수신자 이름" },
        { name: "code", label: "인증 코드" },
        { name: "setupUrl", label: "설정 URL" },
      ],
    },
    {
      displayName: "테스트 관리자",
      loginId: "myknow",
      email: "admin@example.com",
      generation: 0,
    },
  );

  assert.equal(variables.displayName, "테스트 관리자");
  assert.equal(variables.code, "123456");
  assert.equal(variables.setupUrl, "/admin/notification-templates?status=test");
  assert.doesNotMatch(String(variables.setupUrl), /token|password|secret/i);
});

test("템플릿 테스트 푸시 유형은 등록된 이벤트군으로만 매핑한다", async () => {
  const { getTestPushNotificationType } = await deliveryModulePromise;

  assert.equal(getTestPushNotificationType("push.automatic_campaign.new_partner"), "new_partner");
  assert.equal(getTestPushNotificationType("push.automatic_campaign.expiring_partner"), "expiring_partner");
  assert.equal(getTestPushNotificationType("push.admin_campaign.marketing"), "marketing");
  assert.equal(getTestPushNotificationType("push.partner_operational.plan_changed"), "announcement");
});
