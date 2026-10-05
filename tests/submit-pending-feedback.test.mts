import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function count(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length;
}

test("SubmitButton은 pending 표시·비활성·aria-busy를 Button loading에 위임한다", async () => {
  const [submitButton, button] = await Promise.all([
    read("src/components/ui/SubmitButton.tsx"),
    read("src/components/ui/Button.tsx"),
  ]);

  assert.match(submitButton, /const \{ pending \} = useFormStatus\(\);/);
  assert.match(submitButton, /loading=\{pending\}/);
  assert.match(
    submitButton,
    /loadingText=\{pendingText \?\? DEFAULT_SUBMIT_PENDING_TEXT\}/,
  );
  assert.doesNotMatch(submitButton, /Spinner/);
  assert.match(button, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(button, /const isDisabled = Boolean\(disabled \|\| loading\);/);
});

test("비가역 삭제 폼은 확인 단계 뒤 제출하고 pending 동안 다시 제출할 수 없다", async () => {
  const confirmButton = await read(
    "src/components/admin/AdminConfirmSubmitButton.tsx",
  );

  assert.match(confirmButton, /useFormStatus\(\)/);
  assert.match(confirmButton, /type="button"/);
  assert.match(confirmButton, /loading=\{pending\}/);
  assert.match(confirmButton, /<AdminConfirmDialog/);
  assert.match(confirmButton, /open=\{open && !pending\}/);
  assert.match(confirmButton, /formAnchorRef\.current\?\.form\?\.requestSubmit\(\)/);
  assert.doesNotMatch(confirmButton, /window\.confirm/);
});

test("이벤트 상세 삭제와 등록 폼은 pending 보호 제출 버튼을 쓴다", async () => {
  const [detailView, registrationForm] = await Promise.all([
    read("src/components/admin/AdminEventDetailView.tsx"),
    read("src/components/admin/event-management/EventRegistrationForm.tsx"),
  ]);

  assert.match(
    detailView,
    /<form action=\{deleteAction\}[\s\S]*?<AdminConfirmSubmitButton[\s\S]*?이벤트 삭제[\s\S]*?<\/form>/,
  );
  assert.doesNotMatch(detailView, /<Button type="submit" variant="danger">/);
  assert.match(registrationForm, /<form action=\{action\}/);
  assert.match(registrationForm, /<SubmitButton pendingText=/);
  assert.doesNotMatch(registrationForm, /<Button type="submit"/);
});

test("혜택 이용 이력 관리자 폼 3개는 raw submit 버튼 대신 ui 제출 버튼을 쓴다", async () => {
  const source = await read("src/components/partner/PartnerBenefitUsageHistory.tsx");

  assert.equal(count(source, /<form action=\{adminActions\.(create|update|delete)\}/g), 3);
  assert.doesNotMatch(source, /<button type="submit"/);
  assert.equal(count(source, /<SubmitButton /g), 2);
  assert.match(
    source,
    /<form action=\{adminActions\.delete\}[\s\S]*?<AdminConfirmSubmitButton[\s\S]*?이력 삭제[\s\S]*?<\/form>/,
  );
});

test("리뷰 필터 GET 폼은 next/form 클라이언트 탐색으로 적용 중 상태를 보인다", async () => {
  const sources = await Promise.all([
    read("src/components/admin/partner-detail/AdminPartnerReviewManager.tsx"),
    read("src/components/admin/review-manager/AdminReviewFilters.tsx"),
  ]);

  for (const source of sources) {
    assert.match(source, /import Form from "next\/form";/);
    assert.match(source, /<Form action=\{?[^>]+prefetch=\{false\}>/);
    assert.doesNotMatch(source, /method="get"/);
    assert.match(source, /<SubmitButton pendingText="적용 중">적용<\/SubmitButton>/);
  }
});
