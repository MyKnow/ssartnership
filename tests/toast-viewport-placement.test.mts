import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("토스트 뷰포트는 기본으로 safe area 위에 뜬다", async () => {
  const [toast, globals] = await Promise.all([
    read("src/components/ui/Toast.tsx"),
    read("src/app/globals.css"),
  ]);

  assert.match(toast, /data-toast-viewport\s+className="bottom-safe-toast /);
  assert.doesNotMatch(toast, /fixed inset-x-4 bottom-4/);
  assert.match(
    globals,
    /\.bottom-safe-toast \{\s*bottom: calc\(env\(safe-area-inset-bottom\) \+ 1rem\);/,
  );
});

test("관리자 하단 탐색과 플로팅 제출 버튼이 있으면 토스트를 그 위로 올린다", async () => {
  const [globals, adminShell, partnerFloating, partnerCardActions, promotionEditor] =
    await Promise.all([
      read("src/app/globals.css"),
      read("src/components/admin/AdminShellView.tsx"),
      read("src/components/partner/partner-change-request-form/FloatingSubmitButton.tsx"),
      read("src/components/partner-card-form/PartnerFormActions.tsx"),
      read("src/components/admin/promotion-carousel-editor/PromotionCarouselEditor.tsx"),
    ]);

  assert.match(
    globals,
    /body:has\(\[data-admin-mobile-navigation\]\) \[data-toast-viewport\] \{\s*bottom: calc\(env\(safe-area-inset-bottom\) \+ 4\.75rem\);/,
  );
  assert.match(
    globals,
    /body:has\(\[data-floating-submit-button\]\) \[data-toast-viewport\] \{\s*bottom: calc\(env\(safe-area-inset-bottom\) \+ 6rem\);/,
  );
  assert.match(
    globals,
    /body:has\(\[data-floating-submit-button="raised"\]\) \[data-toast-viewport\] \{\s*bottom: calc\(env\(safe-area-inset-bottom\) \+ 9rem\);/,
  );
  // raised 규칙은 일반 플로팅 규칙보다 뒤에 있어야 같은 특이성에서 이긴다.
  assert.ok(
    globals.indexOf('[data-floating-submit-button="raised"]') >
      globals.indexOf("body:has([data-floating-submit-button]) [data-toast-viewport]"),
  );

  assert.match(adminShell, /aria-label="관리자 주요 탐색"\s+data-admin-mobile-navigation/);
  assert.match(partnerFloating, /data-floating-submit-button="base"/);
  for (const source of [partnerCardActions, promotionEditor]) {
    assert.match(source, /data-floating-submit-button="raised"/);
    assert.match(source, /fixed bottom-safe-bottom-20/);
  }
});

test("safe area 커스텀 유틸리티에는 반응형 variant를 붙이지 않는다", () => {
  // globals.css의 @layer utilities 클래스는 Tailwind variant가 생성되지 않아 조용히 무시된다.
  let matches = "";
  try {
    matches = execFileSync(
      "git",
      [
        "grep",
        "-nE",
        "(sm|md|lg|xl|2xl):(bottom-safe|pb-safe|pt-safe|min-safe|safe-site)",
        "--",
        "src",
      ],
      { cwd: new URL("..", import.meta.url), encoding: "utf8" },
    ).trim();
  } catch (error) {
    // git grep exits with 1 when nothing matches.
    if ((error as { status?: number }).status !== 1) throw error;
  }
  assert.equal(matches, "");
});
