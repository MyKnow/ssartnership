import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 고정 액션은 보이지 않는 공통 그룹에서 세로로 쌓인다", async () => {
  const [group, scrollFab, shell, formActions] = await Promise.all([
    readFile(new URL("../src/components/FloatingActionGroup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ScrollToTopFab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminShellView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/partner-card-form/PartnerFormActions.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(group, /pointer-events-none fixed/);
  assert.match(group, /flex-col items-stretch gap-3/);
  assert.match(group, /createPortal/);
  assert.match(scrollFab, /order-first pointer-events-none/);
  assert.match(scrollFab, /<FloatingAction/);
  assert.match(formActions, /order-last pointer-events-auto/);
  assert.match(shell, /<FloatingActionGroup>\s*<ScrollToTopFab \/>\s*<main>[\s\S]*<\/FloatingActionGroup>/);
  assert.equal((shell.match(/<FloatingActionGroup>/g) ?? []).length, 2);
});

test("Portal로 이동한 관리자 저장 버튼은 수정 폼과 연결된다", async () => {
  const [form, formActions] = await Promise.all([
    readFile(new URL("../src/components/partner-card-form/PartnerCardForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/partner-card-form/PartnerFormActions.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(form, /const formId = `partner-card-form-\$\{mode\}-\$\{partner\.id \?\? "new"\}`/);
  assert.match(form, /<form[\s\S]*?id=\{formId\}/);
  assert.match(form, /formId=\{formId\}/);
  assert.match(formActions, /formId\?: string/);
  assert.match(formActions, /form=\{formId\}/);
});
