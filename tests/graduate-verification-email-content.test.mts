import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getNotificationTemplateDefinition } from "@/lib/notification-templates/catalog";

const emailContentModulePromise = import(
  "../src/lib/graduate-verification-email-content.ts"
);

test("수료생 인증 코드 메일은 연속된 OTP와 중복 없는 안내를 사용한다", async () => {
  const { renderGraduateVerificationEmailContent } =
    await emailContentModulePromise;
  const rendered = renderGraduateVerificationEmailContent({
    kind: "application_code",
    code: "428615",
    expirationNotice: "코드는 발급 후 5분 동안 한 번만 사용할 수 있습니다.",
  });

  assert.match(rendered.html, /수료생 인증 코드/);
  assert.match(rendered.html, />428615<\/span>/);
  assert.doesNotMatch(rendered.html, /코드를 길게 눌러 복사|email-code-hint/);
  assert.doesNotMatch(rendered.html, /유효 시간|코드 복사|<button/i);
  assert.match(rendered.text, /\n428615\n/);
  assert.doesNotMatch(rendered.text, /코드를 길게 눌러 복사/);
  assert.match(rendered.text, /발급 후 5분 동안 한 번만/);
});

test("비밀번호 재설정 메일은 문장별 개행과 단일 행동만 제공한다", async () => {
  const { renderGraduateVerificationEmailContent } =
    await emailContentModulePromise;
  const rendered = renderGraduateVerificationEmailContent({
    kind: "password_reset",
    displayName: "김싸피",
    setupUrl:
      "https://ssartnership.myknow.xyz/auth/graduate/setup#token=example",
  });

  assert.match(
    rendered.html,
    />비밀번호를<\/span> <span[^>]*>다시 설정해 주세요<\/span>/,
  );
  assert.match(
    rendered.html,
    /링크를 보내드렸습니다\.<br \/>아래 버튼을 눌러/,
  );
  assert.match(rendered.html, />비밀번호 재설정하기<\/a>/);
  assert.doesNotMatch(
    rendered.html,
    /24시간|버튼이 동작하지 않으면|본인이 요청하지 않았다면/,
  );
});

test("가입 승인 메일은 환영 제목, 승인 상태, 계정 설정 행동을 한 흐름으로 묶는다", async () => {
  const { renderGraduateVerificationEmailContent } =
    await emailContentModulePromise;
  const rendered = renderGraduateVerificationEmailContent({
    kind: "account_setup",
    displayName: "김싸피",
    setupUrl:
      "https://ssartnership.myknow.xyz/auth/graduate/setup#token=example",
    isExistingMemberRecovery: false,
  });

  assert.match(
    rendered.html,
    />싸트너십에<\/span> <span[^>]*>오신 것을 환영합니다<\/span>/,
  );
  assert.match(rendered.html, /인증 승인 완료/);
  assert.match(rendered.html, /구성원 전용 제휴 혜택/);
  assert.match(rendered.html, />계정 설정 완료하기<\/a>/);
  assert.doesNotMatch(rendered.html, /24시간/);
});

test("기존 회원 복구 승인 메일은 신규 가입 환영 문구를 사용하지 않는다", async () => {
  const { renderGraduateVerificationEmailContent } =
    await emailContentModulePromise;
  const rendered = renderGraduateVerificationEmailContent({
    kind: "account_setup",
    displayName: "김싸피",
    setupUrl:
      "https://ssartnership.myknow.xyz/auth/graduate/setup#token=example",
    isExistingMemberRecovery: true,
  });

  assert.match(rendered.html, /계정 복구가/);
  assert.match(rendered.html, /복구 승인 완료/);
  assert.match(rendered.html, />새 비밀번호 설정하기<\/a>/);
  assert.doesNotMatch(rendered.html, /오신 것을 환영합니다/);
});

test("보완 요청 메일은 항목과 관리자 안내를 구분하고 하단 중복 안내를 두지 않는다", async () => {
  const { renderGraduateVerificationEmailContent } =
    await emailContentModulePromise;
  const rendered = renderGraduateVerificationEmailContent({
    kind: "resubmission",
    displayName: "김싸피",
    targets: ["수료증의 이름과 수료 기수", "얼굴을 확인할 수 있는 본인 사진"],
    note: "수료증의 이름 부분이 잘려 있습니다.",
    applicationUrl: "https://ssartnership.myknow.xyz/auth/signup/graduate",
  });

  assert.match(rendered.html, /확인이 필요한 항목이 있어요/);
  assert.match(rendered.html, /ssartnership-email-title-single/);
  assert.match(rendered.html, /보완이 필요한 항목/);
  assert.match(rendered.html, /관리자 안내/);
  assert.match(rendered.html, />보완 자료 제출하기<\/a>/);
  assert.doesNotMatch(rendered.html, /같은 이메일 주소로 인증한 뒤/);
});

test("반려 메일도 같은 카드·푸터 구조와 안전한 사유 표시를 사용한다", async () => {
  const { renderGraduateVerificationEmailContent } =
    await emailContentModulePromise;
  const rendered = renderGraduateVerificationEmailContent({
    kind: "rejection",
    displayName: "김싸피",
    reason: "<script>alert(1)</script> 이름을 확인해 주세요.",
    applicationUrl: "https://ssartnership.myknow.xyz/auth/signup/graduate",
  });

  assert.match(rendered.html, /인증 신청이/);
  assert.match(rendered.html, /반려 사유/);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /<script\b/i);
  assert.match(rendered.html, /mailto:myknow@ssafy\.com/);
});

test("수료생 발송 경계는 기본 디자인과 관리자 사용자 지정 본문을 구분한다", () => {
  const source = readFileSync(
    new URL("../src/lib/graduate-verification-email.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /template\.isCustomized/);
  assert.match(source, /renderEmailTemplateBody/);
  assert.match(source, /renderDefaultBody\(\)/);
  for (const kind of [
    "application_code",
    "password_reset_code",
    "account_setup",
    "password_reset",
    "resubmission",
    "rejection",
  ]) {
    assert.match(source, new RegExp(`"${kind}"`));
  }
});

test("관리자에게 보이는 수료생 기본 템플릿도 제거된 중복 안내를 되살리지 않는다", () => {
  const eventKeys = [
    "email.graduate_application_code",
    "email.graduate_password_reset_code",
    "email.graduate_account_setup",
    "email.graduate_password_reset",
    "email.graduate_resubmission",
    "email.graduate_rejection",
  ];

  for (const eventKey of eventKeys) {
    const template = getNotificationTemplateDefinition(eventKey);
    assert.ok(template);
    assert.doesNotMatch(
      template.bodyTemplate,
      /버튼이 동작하지 않으면|링크는 24시간 동안|이 메일을 무시/,
    );
  }
});
