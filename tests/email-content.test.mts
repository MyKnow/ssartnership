import assert from "node:assert/strict";
import test from "node:test";

const emailContentModulePromise = import("../src/lib/email-content.ts");

test("일반 텍스트 이메일은 HTML 태그를 해석하지 않고 줄바꿈을 보존한다", async () => {
  const { renderEmailBody } = await emailContentModulePromise;
  const rendered = renderEmailBody("안내 <strong>문구</strong>\n다음 줄", "plain");

  assert.match(rendered.text, /^싸트너십\n\n안내 <strong>문구<\/strong>\n다음 줄/);
  assert.match(
    rendered.text,
    /자동으로 발송된 메일입니다\. 문의 사항이 있다면 답장해 주세요\./,
  );
  assert.match(rendered.html, /싸트너십/);
  assert.match(rendered.html, /&lt;strong&gt;문구&lt;\/strong&gt;/);
  assert.match(rendered.html, /다음 줄/);
});

test("모든 이메일 형식에 공통 머릿말과 꼬릿말을 적용한다", async () => {
  const { renderEmailBody } = await emailContentModulePromise;

  for (const format of ["plain", "markdown", "html"] as const) {
    const rendered = renderEmailBody("본문 테스트", format);
    assert.match(
      rendered.text,
      /^싸트너십\n\n본문 테스트\n\n자동으로 발송된 메일입니다\. 문의 사항이 있다면 답장해 주세요\./,
    );
    assert.match(rendered.html, /싸트너십/);
    assert.match(rendered.html, /본문 테스트/);
    assert.match(rendered.html, /자동으로 발송된 메일입니다\./);
    assert.match(
      rendered.html,
      /href="mailto:myknow@ssafy\.com"[^>]*>답장해 주세요\.<\/a>/,
    );
    assert.doesNotMatch(rendered.html, /이 메일은/);
  }
});

test("거래성 이메일은 승인된 정보 위계와 안전한 동작 요소를 렌더링한다", async () => {
  const { renderTransactionalEmail } = await emailContentModulePromise;
  const rendered = renderTransactionalEmail({
    preheader: "가입을 계속하려면 6자리 인증 코드를 입력해 주세요.",
    kicker: "이메일 인증",
    title: "수료생 인증 코드",
    lead: ["싸트너십 가입을 계속하려면 아래 인증 코드를 입력해 주세요."],
    code: {
      label: "6자리 인증 코드",
      value: "428615",
    },
    panels: [
      {
        tone: "info",
        title: "코드는 발급 후 5분 동안 한 번만 사용할 수 있습니다.",
        body: ["인증 코드를 다른 사람에게 전달하지 마세요."],
      },
    ],
  });

  assert.match(rendered.html, /가입을 계속하려면 6자리 인증 코드를 입력해 주세요\./);
  assert.match(rendered.html, />428615<\/span>/);
  assert.doesNotMatch(rendered.html, /코드를 길게 눌러 복사|email-code-hint/);
  assert.match(
    rendered.html,
    /class="ssartnership-email-code-label" style="[^"]*user-select: none; -webkit-user-select: none;[^"]*">6자리 인증 코드<\/span>/,
  );
  assert.match(
    rendered.html,
    /class="ssartnership-email-code" style="[^"]*user-select: all; -webkit-user-select: all; -webkit-touch-callout: default;[^"]*">428615<\/span>/,
  );
  assert.doesNotMatch(rendered.html, /user-select: text/);
  assert.doesNotMatch(rendered.html, /<button|<script|onclick=/i);
  assert.match(rendered.text, /\n428615\n/);
  assert.doesNotMatch(rendered.text, /코드를 길게 눌러 복사/);
  assert.match(rendered.text, /자동으로 발송된 메일입니다\./);
});

test("거래성 이메일 제목은 지정한 어절 경계에서만 줄바꿈되고 문장별 개행을 보존한다", async () => {
  const { renderTransactionalEmail } = await emailContentModulePromise;
  const rendered = renderTransactionalEmail({
    preheader: "요청하신 비밀번호 재설정 링크를 보내드렸습니다.",
    kicker: "계정 보안",
    title: ["비밀번호를", "다시 설정해 주세요"],
    lead: [
      "김싸피님, 요청하신 비밀번호 재설정 링크를 보내드렸습니다.",
      "아래 버튼을 눌러 새 비밀번호를 설정해 주세요.",
    ],
    action: {
      label: "비밀번호 재설정하기",
      url: "https://ssartnership.myknow.xyz/auth/graduate/setup#token=example",
    },
  });

  assert.match(
    rendered.html,
    />비밀번호를<\/span> <span[^>]*>다시 설정해 주세요<\/span>/,
  );
  assert.match(
    rendered.html,
    /링크를 보내드렸습니다\.<br \/>아래 버튼을 눌러/,
  );
  assert.match(rendered.html, /href="https:\/\/ssartnership\.myknow\.xyz\/auth\/graduate\/setup#token=example"/);
  assert.match(
    rendered.html,
    /<div style="margin-top: 28px; text-align: right;"><a class="ssartnership-email-action"/,
  );
  assert.doesNotMatch(
    rendered.html,
    /\.ssartnership-email-action \{ display: block !important;/,
  );
  assert.doesNotMatch(rendered.html, /24시간|버튼이 동작하지 않으면|본인이 요청하지 않았다면/);
});

test("거래성 이메일은 상태·보완 패널의 사용자 입력을 HTML로 실행하지 않는다", async () => {
  const { renderTransactionalEmail } = await emailContentModulePromise;
  const rendered = renderTransactionalEmail({
    preheader: "확인이 필요한 인증 자료가 있습니다.",
    kicker: "인증 보완",
    title: "확인이 필요한 항목이 있어요",
    titleSingleLine: true,
    lead: ["회원님, 아래 자료를 한 번 더 확인해 주세요."],
    panels: [
      {
        tone: "warning",
        title: "보완이 필요한 항목",
        items: ["수료증 <img src=x onerror=alert(1)>", "본인 사진"],
      },
      {
        tone: "info",
        title: "관리자 안내",
        body: ["<script>alert(1)</script> 이름 부분을 확인해 주세요."],
      },
    ],
    action: {
      label: "보완 자료 제출하기",
      url: "https://ssartnership.myknow.xyz/auth/signup/graduate",
    },
  });

  assert.match(rendered.html, /ssartnership-email-title-single/);
  assert.match(rendered.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /<img\b|<script\b/i);
  assert.match(rendered.text, /- 수료증 <img src=x onerror=alert\(1\)>/);

  assert.throws(
    () => renderTransactionalEmail({
      preheader: "위험한 링크",
      kicker: "보안",
      title: "안전한 링크만 허용",
      lead: ["링크를 확인해 주세요."],
      action: {
        label: "열기",
        url: "javascript:alert(1)",
      },
    }),
    /프로토콜/,
  );
});

test("Markdown 이메일은 안전한 HTML과 일반 텍스트 fallback을 생성한다", async () => {
  const { renderEmailBody } = await emailContentModulePromise;
  const rendered = renderEmailBody(
    "**새 제휴**\n\n[혜택 확인](https://example.com/benefit)",
    "markdown",
  );

  assert.match(rendered.html, /<strong>새 제휴<\/strong>/);
  assert.match(rendered.html, /href="https:\/\/example\.com\/benefit"/);
  assert.match(rendered.text, /새 제휴/);
  assert.match(rendered.text, /혜택 확인 \(https:\/\/example\.com\/benefit\)/);
  assert.doesNotMatch(rendered.text, /\*\*/);
});

test("HTML 이메일은 허용 태그만 보존하고 스크립트와 위험한 URL을 제거한다", async () => {
  const { renderEmailBody } = await emailContentModulePromise;
  const rendered = renderEmailBody(
    '<p><strong>안내</strong></p><script>alert("xss")</script><a href="javascript:alert(1)">위험한 링크</a>',
    "html",
  );

  assert.match(rendered.html, /<strong>안내<\/strong>/);
  assert.doesNotMatch(rendered.html, /<script|javascript:/i);
  assert.match(rendered.text, /안내/);
  assert.match(rendered.text, /위험한 링크/);
});

test("이메일 변수 값은 Markdown 또는 HTML 문법으로 실행되지 않는다", async () => {
  const { renderEmailTemplateBody } = await emailContentModulePromise;
  const values = {
    partnerName: '<img src=x onerror="alert(1)"> **악성**',
  };

  const markdown = renderEmailTemplateBody(
    "**{partnerName}**",
    "markdown",
    values,
  );
  const html = renderEmailTemplateBody(
    "<strong>{partnerName}</strong>",
    "html",
    values,
  );

  assert.doesNotMatch(markdown.html, /<img\b|<[^>]*\bonerror\s*=/i);
  assert.match(markdown.text, /\*\*악성\*\*/);
  assert.doesNotMatch(html.html, /<img\b|<[^>]*\bonerror\s*=/i);
  assert.match(html.html, /&lt;img src=x/);
});
