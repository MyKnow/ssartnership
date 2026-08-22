import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL(
  "../src/app/admin/(protected)/advertisement/page.tsx",
  import.meta.url,
);
const viewPath = new URL(
  "../src/components/admin/AdminAdvertisementView.tsx",
  import.meta.url,
);
const packageManagerPath = new URL(
  "../src/components/admin/ad-packages/AdminAdPackageManager.tsx",
  import.meta.url,
);
const carouselEditorPath = new URL(
  "../src/components/admin/promotion-carousel-editor/PromotionCarouselEditor.tsx",
  import.meta.url,
);

test("홈 광고 화면은 조회 권한과 변경 CTA를 분리한다", async () => {
  const [page, view, packageManager, carouselEditor] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(viewPath, "utf8"),
    readFile(packageManagerPath, "utf8"),
    readFile(carouselEditorPath, "utf8"),
  ]);

  assert.match(
    page,
    /canAdmin\(session\.account\.permissions, "home_ads", "create"\)/,
  );
  assert.match(
    page,
    /canAdmin\(session\.account\.permissions, "home_ads", "update"\)/,
  );
  assert.match(view, /canCreate = true/);
  assert.match(view, /canUpdate = true/);
  assert.match(view, /canUpdate=\{canUpdate\}/);
  assert.match(packageManager, /canCreate\s*\?\s*\(/);
  assert.match(packageManager, /canUpdate\s*\?\s*\(/);
  assert.match(carouselEditor, /canUpdate = true/);
  assert.match(
    carouselEditor,
    /현재 계정은 광고 카드를 조회할 수 있지만 수정할 수 없습니다/,
  );
  assert.match(carouselEditor, /if \(!canUpdate\)/);
});
