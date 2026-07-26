import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("제휴처 상세는 수정·리뷰·미리보기 작업을 권한에 맞춰 노출한다", async () => {
  const [page, edit, preview, deferred, reviewManager] = await Promise.all([
    read("src/app/admin/(protected)/partners/[partnerId]/page.tsx"),
    read("src/components/admin/AdminPartnerDetailEditSection.tsx"),
    read("src/components/admin/AdminPartnerPreviewLinkPanel.tsx"),
    read("src/components/admin/AdminPartnerDetailDeferredSections.tsx"),
    read("src/components/admin/partner-detail/AdminPartnerReviewManager.tsx"),
  ]);

  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"brands",\s*"update"/,
  );
  assert.match(page, /canUpdate=\{canUpdatePartner\}/);
  assert.match(edit, /canUpdatePartner \?/);
  assert.match(edit, /조회 전용 권한/);
  assert.match(preview, /canUpdate = true/);
  assert.match(
    preview,
    /링크 관리는 제휴처 수정 권한이 있는 관리자만 할 수 있습니다/,
  );
  assert.match(deferred, /canUpdate\?: boolean/);
  assert.match(deferred, /canDelete\?: boolean/);
  assert.match(reviewManager, /canUpdate = true/);
  assert.match(reviewManager, /canDelete = true/);
});
