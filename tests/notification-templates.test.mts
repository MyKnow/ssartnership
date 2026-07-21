import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogModulePromise = import("../src/lib/notification-templates/catalog.ts");
const templateModulePromise = import("../src/lib/notification-templates/template.ts");
const contextModulePromise = import("../src/lib/notification-templates/context.ts");

test("알림 템플릿은 중복 없이 변수 이름을 추출한다", async () => {
  const { extractTemplateVariables } = await templateModulePromise;

  assert.deepEqual(
    extractTemplateVariables("{displayName}님 {code} {displayName} {invalid-name} {0bad}"),
    ["displayName", "code"],
  );
});

test("알림 템플릿은 허용되지 않은 변수와 필수 변수 누락을 거부한다", async () => {
  const { getNotificationTemplateDefinition } = await catalogModulePromise;
  const { validateNotificationTemplate } = await templateModulePromise;
  const definition = getNotificationTemplateDefinition("email.graduate_rejection");

  assert.ok(definition);
  assert.throws(
    () => validateNotificationTemplate(definition, "{displayName}", "{unknown}"),
    /허용되지 않은 변수/,
  );
  assert.throws(
    () => validateNotificationTemplate(definition, "제목", "반려되었습니다."),
    /필수 변수/,
  );
});

test("알림 템플릿은 변수 값을 안전하게 치환한다", async () => {
  const { renderNotificationTemplate } = await templateModulePromise;

  assert.equal(
    renderNotificationTemplate("{displayName}님\n{reason}", {
      displayName: "홍길동",
      reason: "사진을 다시 제출해 주세요.",
    }),
    "홍길동님\n사진을 다시 제출해 주세요.",
  );
  assert.throws(
    () => renderNotificationTemplate("{missing}", {}),
    /필수 변수/,
  );
});

test("모든 현재 전송 채널의 템플릿과 반려 이메일 템플릿을 카탈로그에 등록한다", async () => {
  const { NOTIFICATION_TEMPLATE_CATALOG } = await catalogModulePromise;
  const { validateNotificationTemplate } = await templateModulePromise;
  const channels = new Set(NOTIFICATION_TEMPLATE_CATALOG.map((item) => item.channel));

  assert.deepEqual(channels, new Set(["email", "mattermost", "push", "in_app"]));
  assert.ok(
    NOTIFICATION_TEMPLATE_CATALOG.some(
      (item) => item.eventKey === "email.graduate_rejection",
    ),
  );
  assert.ok(
    NOTIFICATION_TEMPLATE_CATALOG.some(
      (item) => item.eventKey === "mattermost.signup_code",
    ),
  );
  assert.ok(
    NOTIFICATION_TEMPLATE_CATALOG.some(
      (item) => item.eventKey === "push.partner_operational.plan_upgrade_rejected",
    ),
  );
  for (const definition of NOTIFICATION_TEMPLATE_CATALOG) {
    assert.equal(
      definition.bodyFormat,
      definition.channel === "email" ? "markdown" : "plain",
    );
    assert.doesNotThrow(() =>
      validateNotificationTemplate(
        definition,
        definition.titleTemplate,
        definition.bodyTemplate,
      ),
    );
  }
});

test("Mattermost 인증 코드 템플릿은 5분 만료 문구와 운영 보정 마이그레이션을 사용한다", async () => {
  const { NOTIFICATION_TEMPLATE_CATALOG } = await catalogModulePromise;
  const mattermostCodeTemplates = NOTIFICATION_TEMPLATE_CATALOG.filter((item) =>
    item.eventKey === "mattermost.signup_code"
      || item.eventKey === "mattermost.reset_password_code",
  );

  assert.equal(mattermostCodeTemplates.length, 2);
  for (const template of mattermostCodeTemplates) {
    assert.equal(template.titleTemplate, "### [SSARTNERSHIP] {title}");
    assert.match(template.bodyTemplate, /5분/);
    assert.match(
      template.bodyTemplate,
      /아래 코드를 복사해서 입력하세요\.\n\n```\n\{code\}\n```\n- 유효 시간: 5분\n---\n타인에게 노출하지 마세요\./,
    );
    assert.doesNotMatch(template.bodyTemplate, /10분/);
  }

  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260719020027_update_mattermost_code_template_ttl.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /mattermost\.signup_code/);
  assert.match(migration, /mattermost\.reset_password_code/);
  assert.match(migration, /10\[\[:space:\]\]\*분/);
  assert.match(migration, /5분/);

  const formatMigration = await readFile(
    new URL(
      "../supabase/migrations/20260721131819_update_mattermost_code_template_format.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(formatMigration, /### \[SSARTNERSHIP\] \{title\}/);
  assert.match(formatMigration, /아래 코드를 복사해서 입력하세요/);
  assert.match(formatMigration, /타인에게 노출하지 마세요/);
});

test("의미 기반 자동·운영 템플릿은 실제 이벤트 변수를 계약한다", async () => {
  const { NOTIFICATION_TEMPLATE_CATALOG, getCampaignTemplateKey } = await catalogModulePromise;
  const { validateNotificationTemplate, renderNotificationTemplate } = await templateModulePromise;
  const { getNotificationTemplateContextVariables } = await contextModulePromise;

  const newPartner = NOTIFICATION_TEMPLATE_CATALOG.find(
    (item) => item.eventKey === "in_app.automatic_campaign.new_partner",
  );
  assert.ok(newPartner);
  assert.equal(newPartner.source, "automatic");
  assert.equal(newPartner.contextKey, "new_partner");
  assert.ok(newPartner.requiredVariables.includes("partnerName"));
  assert.ok(newPartner.requiredVariables.includes("partnerCategory"));
  assert.ok(newPartner.requiredVariables.includes("benefitSummary"));
  assert.match(newPartner.bodyTemplate, /\{partnerLocation\}/);
  assert.doesNotMatch(newPartner.bodyTemplate, /\{title\}|\{body\}/);

  const context = getNotificationTemplateContextVariables({
    kind: "new_partner",
    partnerName: "오늘의 식당",
    partnerCategory: "식음료",
    partnerLocation: "서울 강남구",
    partnerUrl: "/partners/today",
    campusNames: "서울 캠퍼스",
    benefitSummary: "식사 10% 할인",
    conditions: "학생증 제시",
    periodStart: "2026-07-01",
    periodEnd: "2026-12-31",
    mapUrl: "https://map.example.com/today",
  });
  assert.equal(context.partnerName, "오늘의 식당");
  assert.equal(context.benefitSummary, "식사 10% 할인");
  assert.equal("password" in context, false);
  const rendered = renderNotificationTemplate(
    newPartner.titleTemplate + "\n" + newPartner.bodyTemplate,
    context,
  );
  assert.match(rendered, /오늘의 식당/);
  assert.match(rendered, /식음료/);
  assert.match(rendered, /서울 강남구/);
  assert.match(rendered, /식사 10% 할인/);
  assert.match(rendered, /\/partners\/today/);

  const expiring = NOTIFICATION_TEMPLATE_CATALOG.find(
    (item) => item.eventKey === "push.automatic_campaign.expiring_partner",
  );
  assert.ok(expiring);
  assert.deepEqual(
    getCampaignTemplateKey("push", "expiring_partner", "automatic"),
    "push.automatic_campaign.expiring_partner",
  );
  assert.throws(
    () => validateNotificationTemplate(expiring, expiring.titleTemplate, "{partnerName}"),
    /필수 변수/,
  );

  for (const definition of NOTIFICATION_TEMPLATE_CATALOG) {
    assert.doesNotThrow(() =>
      validateNotificationTemplate(definition, definition.titleTemplate, definition.bodyTemplate),
    );
  }
});

test("수동 캠페인은 기존 {title}, {body} 계약을 유지하고 metrics_digest는 비활성으로 표시한다", async () => {
  const { NOTIFICATION_TEMPLATE_CATALOG, getCampaignTemplateKey } = await catalogModulePromise;
  const { validateNotificationTemplate } = await templateModulePromise;
  const manual = NOTIFICATION_TEMPLATE_CATALOG.find(
    (item) => item.eventKey === "in_app.admin_campaign.announcement",
  );
  assert.ok(manual);
  assert.equal(manual.source, "manual");
  assert.doesNotThrow(() => validateNotificationTemplate(manual, "{title}", "{body}"));
  assert.equal(getCampaignTemplateKey("in_app", "announcement"), "in_app.admin_campaign.announcement");

  const metrics = NOTIFICATION_TEMPLATE_CATALOG.find(
    (item) => item.eventKey === "push.partner_operational.metrics_digest",
  );
  assert.ok(metrics);
  assert.equal(metrics.isActive, false);
  assert.match(metrics.description, /현재 발송 경로/);
});

test("기존 사용자 지정 문구는 삭제하지 않고 새 계약과 맞지 않으면 호환 override로 분류한다", async () => {
  const { getNotificationTemplateDefinition } = await catalogModulePromise;
  const { classifyNotificationTemplateOverride } = await templateModulePromise;
  const definition = getNotificationTemplateDefinition("in_app.partner_operational.plan_changed");
  assert.ok(definition);

  assert.deepEqual(
    classifyNotificationTemplateOverride(definition, "{title}", "{body}"),
    {
      valid: false,
      error: "기존 사용자 지정 문구가 현재 변수 계약과 맞지 않습니다.",
    },
  );
  assert.deepEqual(
    classifyNotificationTemplateOverride(
      definition,
      definition.titleTemplate,
      definition.bodyTemplate,
    ),
    { valid: true, error: null },
  );
});

test("반려와 계정 전달 경로는 알림 템플릿을 사용한다", async () => {
  const [graduateService, manualImport, manualAdd, cycleActions, suggestionRoute, memberEmail, partnerEmail] =
    await Promise.all([
      readFile(
        new URL("../src/lib/graduate-verification-service.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/member-manual-import/service.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/member-manual-add/provision.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/app/admin/(protected)/_actions/cycle-actions.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../src/app/api/suggest/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/lib/member-email.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/lib/partner-email.ts", import.meta.url), "utf8"),
    ]);

  assert.match(graduateService, /sendGraduateVerificationRejectionEmail/);
  assert.match(graduateService, /rejection_email_sent_at/);
  assert.match(graduateService, /rejection_email_last_error_at/);
  assert.match(manualImport, /email\.manual_member_setup/);
  assert.match(manualImport, /mattermost\.manual_member_setup/);
  assert.match(manualAdd, /mattermost\.manual_member_temporary_password/);
  assert.match(cycleActions, /mattermost\.sender_test/);
  assert.match(suggestionRoute, /email\.partner_suggestion_received/);
  assert.match(memberEmail, /renderEmailTemplateBody/);
  assert.match(partnerEmail, /renderEmailTemplateBody/);
});

test("활성 자동·운영 producer는 임의 metadata 대신 타입화된 컨텍스트를 전달한다", async () => {
  const [newPartner, expiringOps, partnerPlan, adminSecurity, partnerImmediate, partnerApproval] =
    await Promise.all([
      readFile(new URL("../src/lib/new-partner-notifications.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/lib/push/ops.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/lib/partner-plan-service.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/app/admin/(protected)/_actions/admin-account-actions.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/app/partner/services/[partnerId]/request/_actions/immediate.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/app/partner/services/[partnerId]/request/_actions/approval.ts", import.meta.url), "utf8"),
    ]);

  assert.match(newPartner, /kind: "new_partner"/);
  assert.match(expiringOps, /kind: "expiring_partner"/);
  assert.match(expiringOps, /kind: "admin_expiring_partner"/);
  assert.match(expiringOps, /kind: "partner_expiring_partner"/);
  assert.match(partnerPlan, /kind: "admin_partner_plan_upgrade_request"/);
  assert.match(partnerPlan, /kind: "partner_plan_upgrade_requested"/);
  assert.match(partnerPlan, /kind: "partner_plan_changed"/);
  assert.match(partnerPlan, /kind: "partner_plan_upgrade_approved"/);
  assert.match(partnerPlan, /kind: "partner_plan_upgrade_rejected"/);
  assert.match(adminSecurity, /templateVariant: "security_permission_granted"/);
  assert.match(adminSecurity, /templateVariant: "security_status_changed"/);
  assert.match(adminSecurity, /templateVariant: "security_template_changed"/);
  assert.match(partnerImmediate, /kind: "admin_partner_immediate_update"/);
  assert.match(partnerApproval, /kind: "admin_partner_change_request"/);
});

test("알림 템플릿 테이블은 RLS와 service_role 전용 접근을 사용한다", async () => {
  const [schema, migration, bodyFormatMigration] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260717223116_add_notification_templates.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260718011220_add_notification_template_body_format.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const sql of [schema, migration]) {
    assert.match(sql, /notification_templates/);
    assert.match(sql, /alter table (?:public\.)?notification_templates enable row level security/i);
    assert.match(sql, /revoke all on table (?:public\.)?notification_templates from anon/i);
    assert.match(sql, /revoke all on table (?:public\.)?notification_templates from authenticated/i);
  }
  assert.match(schema, /body_format text not null default 'plain'/i);
  assert.match(schema, /notification_templates_body_format_check/i);
  assert.match(bodyFormatMigration, /add column if not exists body_format/i);
  assert.match(bodyFormatMigration, /body_format in \('plain', 'markdown', 'html'\)/i);
});

test("템플릿 관리자는 서버에서 수신 회원을 재검증하고 모든 템플릿을 테스트 발송할 수 있다", async () => {
  const [action, page, component, delivery] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/notification-templates/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/notification-templates/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminNotificationTemplateManager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/notification-templates/test-delivery.server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(action, /sendNotificationTemplateTestAction/);
  assert.match(action, /requireNotificationTemplateAdmin\("update"/);
  assert.match(action, /memberId/);
  assert.match(page, /listNotificationTemplateTestRecipients/);
  assert.match(component, /<details/);
  assert.match(component, /useState\(false\)/);
  assert.match(component, /테스트 발송/);
  assert.match(delivery, /getRecipientById/);
  assert.match(delivery, /is\("deleted_at", null\)/);
  assert.match(delivery, /withActiveMattermostSenderForSubject/);
  assert.match(delivery, /sendPushTemplateTest/);
  assert.match(delivery, /createNotification/);

  const memberSelect = delivery.match(/const MEMBER_SELECT =\s*"([^"]+)"/)?.[1];
  assert.equal(
    memberSelect,
    "id,display_name,email,generation,staff_source_generation,mattermost_account_id,deleted_at",
  );
});
