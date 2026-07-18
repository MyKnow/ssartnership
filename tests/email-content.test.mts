import assert from "node:assert/strict";
import test from "node:test";

const emailContentModulePromise = import("../src/lib/email-content.ts");

test("일반 텍스트 이메일은 HTML 태그를 해석하지 않고 줄바꿈을 보존한다", async () => {
  const { renderEmailBody } = await emailContentModulePromise;
  const rendered = renderEmailBody("안내 <strong>문구</strong>\n다음 줄", "plain");

  assert.match(rendered.text, /^싸트너십\n\n안내 <strong>문구<\/strong>\n다음 줄/);
  assert.match(rendered.text, /이 메일은 싸트너십에서 발송되었습니다\./);
  assert.match(rendered.html, /싸트너십/);
  assert.match(rendered.html, /&lt;strong&gt;문구&lt;\/strong&gt;/);
  assert.match(rendered.html, /다음 줄/);
});

test("모든 이메일 형식에 공통 머릿말과 꼬릿말을 적용한다", async () => {
  const { renderEmailBody } = await emailContentModulePromise;

  for (const format of ["plain", "markdown", "html"] as const) {
    const rendered = renderEmailBody("본문 테스트", format);
    assert.match(rendered.text, /^싸트너십\n\n본문 테스트\n\n이 메일은 싸트너십에서 발송되었습니다\./);
    assert.match(rendered.html, /싸트너십/);
    assert.match(rendered.html, /본문 테스트/);
    assert.match(rendered.html, /이 메일은 싸트너십에서 발송되었습니다\./);
  }
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
