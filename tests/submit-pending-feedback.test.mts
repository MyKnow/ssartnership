import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navigationFormHrefModulePromise = import(
  new URL("../src/components/ui/navigation-form-href.ts", import.meta.url).href
) as Promise<typeof import("../src/components/ui/navigation-form-href.ts")>;

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

  assert.match(submitButton, /const \{ pending: actionPending \} = useFormStatus\(\);/);
  assert.match(submitButton, /const navigationPending = useNavigationFormPending\(\);/);
  assert.match(submitButton, /const pending = actionPending \|\| navigationPending;/);
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

test("리뷰 필터 GET 폼은 transition 안에서 이동해 적용 중 상태를 보인다", async () => {
  const [navigationForm, ...sources] = await Promise.all([
    read("src/components/ui/NavigationForm.tsx"),
    read("src/components/admin/partner-detail/AdminPartnerReviewManager.tsx"),
    read("src/components/admin/review-manager/AdminReviewFilters.tsx"),
  ]);

  // next/form은 문자열 action에서 router.push만 호출해 useFormStatus가 pending이 되지 않는다.
  assert.match(navigationForm, /const \[pending, startTransition\] = useTransition\(\);/);
  assert.match(navigationForm, /startTransition\(\(\) => \{\s*router\.push\(href\);\s*\}\);/);
  assert.match(navigationForm, /<NavigationFormPendingContext\.Provider value=\{pending\}>/);
  assert.match(navigationForm, /method="get"/);
  assert.doesNotMatch(navigationForm, /from "next\/form"/);

  for (const source of sources) {
    assert.doesNotMatch(source, /from "next\/form"/);
    assert.match(source, /<NavigationForm action=\{?[^>]+>/);
    assert.match(source, /<SubmitButton pendingText="적용 중">적용<\/SubmitButton>/);
  }
});

test("GET 폼 이동 주소는 브라우저 GET 제출과 같은 query를 만든다", async () => {
  const { buildGetFormHref } = await navigationFormHrefModulePromise;

  assert.equal(
    buildGetFormHref("/admin/reviews", [
      ["status", "hidden"],
      ["memberQuery", "김 싸피&1"],
      ["partnerId", ""],
    ]),
    "/admin/reviews?status=hidden&memberQuery=%EA%B9%80+%EC%8B%B8%ED%94%BC%261&partnerId=",
  );
  assert.equal(
    buildGetFormHref("/admin/partners/p-1?tab=reviews#reviews", [["rating", "5"]]),
    "/admin/partners/p-1?rating=5",
  );
  assert.equal(buildGetFormHref("/admin/reviews", []), "/admin/reviews");
});
