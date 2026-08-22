import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getNotificationTemplateDefinition,
  NOTIFICATION_TEMPLATE_CATALOG,
} from "@/lib/notification-templates/catalog";
import { getNotificationTemplateTestVariables } from "@/lib/notification-templates/test-delivery";
import { mergeNotificationTemplateVariables } from "@/lib/notification-templates/context";

const notificationEmailContentModulePromise = import(
  "../src/lib/notification-email-content.ts"
);

const recipient = {
  displayName: "김싸피",
  loginId: "myknow",
  email: "test@example.com",
  generation: 15,
};

const nonGraduateEmailDefinitions = NOTIFICATION_TEMPLATE_CATALOG.filter(
  (definition) =>
    definition.channel === "email" &&
    !definition.eventKey.startsWith("email.graduate_"),
);

test("수료생 외 모든 이메일 기본 템플릿은 전용 거래성 디자인으로 렌더링된다", async () => {
  const {
    DEFAULT_NOTIFICATION_EMAIL_EVENT_KEYS,
    renderDefaultNotificationEmailContent,
  } = await notificationEmailContentModulePromise;

  assert.equal(nonGraduateEmailDefinitions.length, 15);
  assert.deepEqual(
    [...DEFAULT_NOTIFICATION_EMAIL_EVENT_KEYS].sort(),
    nonGraduateEmailDefinitions.map((definition) => definition.eventKey).sort(),
  );

  for (const definition of nonGraduateEmailDefinitions) {
    const variables = getNotificationTemplateTestVariables(definition, recipient);
    const rendered = renderDefaultNotificationEmailContent(
      definition.eventKey,
      variables,
    );

    assert.ok(rendered, `${definition.eventKey} 기본 렌더러 누락`);
    assert.match(rendered.html, /싸트너십/);
    assert.match(rendered.html, /mailto:myknow@ssafy\.com/);
    assert.match(rendered.text, /자동으로 발송된 메일입니다\./);
    assert.doesNotMatch(
      rendered.html,
      /코드를 길게 눌러 복사|email-code-hint|<button|onclick=|<script\b/i,
    );
  }
});

test("회원 인증 코드는 숫자만 선택되고 OS OTP 감지를 위한 연속 6자리를 유지한다", async () => {
  const { renderDefaultNotificationEmailContent } =
    await notificationEmailContentModulePromise;
  const rendered = renderDefaultNotificationEmailContent(
    "email.member_email_verification_code",
    {
      siteName: "싸트너십",
      code: "428615",
      expiresInMinutes: 10,
    },
  );

  assert.ok(rendered);
  assert.match(rendered.html, />428615<\/span>/);
  assert.match(
    rendered.html,
    /ssartnership-email-code-label[^>]*user-select: none;/,
  );
  assert.match(
    rendered.html,
    /ssartnership-email-code[^>]*user-select: all;/,
  );
  assert.match(rendered.text, /\n428615\n/);
  assert.doesNotMatch(rendered.html, /복사하기|코드 복사|유효 시간/);
});

test("링크형 기본 이메일 CTA는 항상 우측 정렬되고 상대 경로도 실제 링크로 변환된다", async () => {
  const { renderDefaultNotificationEmailContent } =
    await notificationEmailContentModulePromise;
  const definitionsWithAction = nonGraduateEmailDefinitions.filter(
    (definition) =>
      ![
        "email.member_email_verification_code",
        "email.partner_suggestion_received",
        "email.partner_temporary_password",
      ].includes(definition.eventKey),
  );

  for (const definition of definitionsWithAction) {
    const rendered = renderDefaultNotificationEmailContent(
      definition.eventKey,
      getNotificationTemplateTestVariables(definition, recipient),
    );
    assert.ok(rendered);
    assert.match(
      rendered.html,
      /<div style="margin-top: 28px; text-align: right;"><a class="ssartnership-email-action"/,
      `${definition.eventKey} CTA 정렬`,
    );
    assert.match(
      rendered.html,
      /class="ssartnership-email-action" href="https:\/\//,
      `${definition.eventKey} CTA URL`,
    );
  }
});

test("관리자 사용자 지정 본문은 전용 기본 디자인보다 우선한다", async () => {
  const { renderResolvedNotificationEmailContent } =
    await notificationEmailContentModulePromise;
  const definition = getNotificationTemplateDefinition(
    "email.manual_member_password_reset",
  );
  assert.ok(definition);

  const customized = renderResolvedNotificationEmailContent({
    eventKey: definition.eventKey,
    bodyTemplate: "사용자 지정 안내: {displayName}",
    bodyFormat: "plain",
    isCustomized: true,
    variables: {
      siteName: "싸트너십",
      displayName: "김싸피",
      setupUrl: "https://ssartnership.myknow.xyz/account/setup/member",
    },
  });
  assert.match(customized.html, /사용자 지정 안내: 김싸피/);
  assert.doesNotMatch(customized.html, /비밀번호를 다시 설정해 주세요/);

  const defaultBody = renderResolvedNotificationEmailContent({
    eventKey: definition.eventKey,
    bodyTemplate: definition.bodyTemplate,
    bodyFormat: definition.bodyFormat,
    isCustomized: false,
    variables: {
      siteName: "싸트너십",
      displayName: "김싸피",
      setupUrl: "https://ssartnership.myknow.xyz/account/setup/member",
    },
  });
  assert.match(defaultBody.html, /비밀번호를/);
  assert.match(defaultBody.html, /다시 설정해 주세요/);
});

test("초기 설정 재발급 메일은 일반 비밀번호 재설정과 목적을 분명히 구분한다", async () => {
  const { renderDefaultNotificationEmailContent } =
    await notificationEmailContentModulePromise;
  const rendered = renderDefaultNotificationEmailContent(
    "email.manual_member_setup_reissue",
    {
      siteName: "싸트너십",
      displayName: "김싸피",
      setupUrl: "https://ssartnership.myknow.xyz/auth/member/setup#token=example",
    },
  );

  assert.ok(rendered);
  assert.match(rendered.html, />계정 설정을<\/span>/);
  assert.match(rendered.html, />완료해 주세요<\/span>/);
  assert.match(rendered.html, /계정 설정을 계속할 수 있도록 새 링크를 보내드렸습니다/);
  assert.match(rendered.html, /비밀번호 설정하기/);
  assert.doesNotMatch(rendered.html, /요청하신 비밀번호 재설정 링크/);
});

test("플랜 변경 컨텍스트는 기본·사용자 지정 이메일이 공유하는 변수 이름을 제공한다", () => {
  const variables = mergeNotificationTemplateVariables({
    context: {
      kind: "partner_plan_changed",
      partnerName: "테스트 제휴처",
      previousPlanName: "Basic",
      nextPlanName: "Premium",
      effectiveAt: "2026-08-22",
      expiresAt: "2026-09-21",
      planUrl: "/partner/plans",
      note: "테스트 안내",
    },
  });

  assert.equal(variables.nextPlanName, "Premium");
  assert.equal(variables.requestedPlanName, "Premium");
});

test("관리자 편집기에 보이는 모든 이메일 기본 문구도 제거한 중복 안내를 되살리지 않는다", () => {
  const emailDefinitions = NOTIFICATION_TEMPLATE_CATALOG.filter(
    (definition) => definition.channel === "email",
  );

  assert.equal(emailDefinitions.length, 21);
  for (const definition of emailDefinitions) {
    assert.doesNotMatch(
      definition.bodyTemplate,
      /링크는 24시간 동안|버튼이 동작하지 않으면|이 메일을 무시|이 메일에 회신/,
      definition.eventKey,
    );
  }
});

test("모든 비수료생 이메일 발송 경계가 기본 디자인과 관리자 커스텀 우선순위를 함께 사용한다", () => {
  const sourceFiles = [
    "../src/lib/member-email.ts",
    "../src/lib/member-email-login-transition.ts",
    "../src/lib/member-password-action-email.ts",
    "../src/lib/member-manual-import/service.server.ts",
    "../src/app/api/suggest/route.ts",
    "../src/lib/partner-email.ts",
  ];

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(new URL(sourceFile, import.meta.url), "utf8");
    assert.match(source, /renderResolvedNotificationEmailContent/);
    assert.match(source, /isCustomized:\s*template\.isCustomized/);
  }

  const testDeliverySource = readFileSync(
    new URL(
      "../src/lib/notification-templates/test-delivery.server.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(testDeliverySource, /renderResolvedNotificationEmailContent/);
  assert.match(testDeliverySource, /definition\.bodyTemplate/);
  assert.match(testDeliverySource, /definition\.bodyFormat/);
});
