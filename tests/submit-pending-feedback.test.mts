import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { existsSync } from "node:fs";

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

test("회원 상세 프로필 사진 승인·반려 폼은 제출 중 다시 제출할 수 없다", async () => {
  const source = await read(
    "src/components/admin/member-detail/AdminMemberProfilePhotoPanel.tsx",
  );

  for (const action of ["approveAction", "rejectReplacementAction", "rejectCurrentAction"]) {
    assert.match(
      source,
      new RegExp(`<form action=\\{${action}\\}[\\s\\S]*?<SubmitButton [^>]*pendingText="[^"]+"[\\s\\S]*?</form>`),
      action,
    );
  }
  assert.doesNotMatch(source, /<Button [^>]*type="submit"/);
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

function findTagEnd(source: string, start: number) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (character === ">" && depth === 0) return index;
  }
  return -1;
}

function readAttributeExpression(tag: string, name: string) {
  const match = new RegExp(`\\s${name}=\\{`).exec(tag);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  for (let index = start; index < tag.length; index += 1) {
    if (tag[index] === "{") depth += 1;
    else if (tag[index] === "}" && (depth -= 1) === 0) {
      return tag.slice(start, index).trim();
    }
  }
  return null;
}

const PENDING_DISABLED_PATTERN =
  /\bdisabled=\{[^}]*\b(pending|isPending|submitting|isSubmitting|saving|isSaving|loading|isLoading)\b/;

/**
 * Server Action 폼 안의 plain submit 버튼(`<Button|button type="submit">`) 중
 * `loading` 또는 pending 기반 `disabled`가 없는 것을 `파일#action` 형태로 모은다.
 * SubmitButton·AdminConfirmSubmitButton·FloatingSubmitButton·FormSubmitButton은
 * 내부에서 pending을 처리하므로 소스에 `type="submit"`이 드러나지 않는다.
 */
async function collectUnprotectedServerActionForms() {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/**/*.tsx"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => file && !file.endsWith(".stories.tsx") && existsSync(new URL(`../${file}`, import.meta.url)));
  const offenders = new Set<string>();

  for (const file of files) {
    const source = await read(file);
    for (const form of source.matchAll(/<form\b/g)) {
      const openEnd = findTagEnd(source, form.index);
      if (openEnd === -1) continue;
      const openTag = source.slice(form.index, openEnd + 1);
      if (/\smethod="get"/i.test(openTag)) continue;
      const action = readAttributeExpression(openTag, "action");
      // 문자열·경로 상수 action은 GET 이동 폼이라 대상이 아니다.
      if (!action || /^[A-Z][A-Z0-9_]*$/.test(action) || /["'`]/.test(action)) continue;
      const closeIndex = source.indexOf("</form>", openEnd);
      const body = source.slice(openEnd + 1, closeIndex === -1 ? source.length : closeIndex);
      for (const button of body.matchAll(/<(button|Button)\b/g)) {
        const tag = body.slice(button.index, findTagEnd(body, button.index) + 1);
        if (!/\stype="submit"/.test(tag)) continue;
        if (/\sloading=\{/.test(tag) || PENDING_DISABLED_PATTERN.test(tag)) continue;
        offenders.add(`${file}#${action}`);
      }
    }
  }
  return [...offenders].sort();
}

const SERVER_ACTION_FORMS_PENDING_INTEGRATION: string[] = [];

test("Server Action 폼의 제출 버튼은 pending 동안 다시 제출할 수 없다(래칫)", async () => {
  assert.deepEqual(
    await collectUnprotectedServerActionForms(),
    SERVER_ACTION_FORMS_PENDING_INTEGRATION,
    "Server Action 폼에는 SubmitButton(비가역 삭제는 AdminConfirmSubmitButton)을 쓰고, 허용 목록은 옮겨진 폼을 고친 뒤 줄입니다.",
  );
});

test("홈 광고 편집 저장 버튼은 저장 중 다시 제출할 수 없다", async () => {
  const source = await read(
    "src/components/admin/promotion-carousel-editor/PromotionCarouselEditor.tsx",
  );

  assert.match(
    source,
    /data-floating-submit-button="raised"[\s\S]*?<SubmitButton[\s\S]*?disabled=\{!canSave\}[\s\S]*?pendingText="저장 중"[\s\S]*?저장\s*<\/SubmitButton>/,
  );
});

/**
 * `form` 속성으로 바깥 form에 연결한 SubmitButton은 useFormStatus가 조상 form만 읽어
 * 제출 중 상태를 받지 못한다. 같은 파일 안에서 `<form>` 밖에 놓인 `form=` SubmitButton을
 * `파일:줄` 형태로 모은다.
 */
async function collectExternalFormSubmitButtons() {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/**/*.tsx"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => file && !file.endsWith(".stories.tsx") && existsSync(new URL(`../${file}`, import.meta.url)));
  const offenders: string[] = [];

  for (const file of files) {
    const source = await read(file);
    for (const button of source.matchAll(/<SubmitButton\b/g)) {
      const tag = source.slice(button.index, findTagEnd(source, button.index) + 1);
      if (!/\sform=[{"]/.test(tag)) continue;
      const before = source.slice(0, button.index);
      if (count(before, /<form\b/g) - count(before, /<\/form>/g) <= 0) {
        offenders.push(`${file}:${before.split("\n").length}`);
      }
    }
  }
  return offenders.sort();
}

test("SubmitButton은 form 속성으로 바깥 form을 가리키지 않고 제출하는 form 안에 렌더한다", async () => {
  assert.deepEqual(
    await collectExternalFormSubmitButtons(),
    [],
    "form 밖 SubmitButton은 제출 중에도 비활성화되지 않습니다. 레이아웃은 contents form으로 감싸 버튼을 form 안에 두세요.",
  );

  const [categoryManager, themeManager] = await Promise.all([
    read("src/components/admin/AdminCategoryManager.tsx"),
    read("src/components/admin/cohort-card-themes/AdminCohortCardThemeManager.tsx"),
  ]);
  assert.match(
    categoryManager,
    /<form action=\{updateAction\} className="contents">[\s\S]*?<SubmitButton variant="ghost" pendingText="수정 중">[\s\S]*?<\/form>/,
  );
  assert.match(
    themeManager,
    /<form action=\{upsertAction\} className="contents">[\s\S]*?pendingText="저장 중"[\s\S]*?<\/form>/,
  );
  assert.match(
    themeManager,
    /<form action=\{deleteAction\} className="contents">[\s\S]*?pendingText="삭제 중"[\s\S]*?<\/form>/,
  );
});
