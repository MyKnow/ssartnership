import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("리뷰 운영은 조회·상태 변경·삭제 권한에 맞춰 작업을 노출한다", async () => {
  const [page, manager, view] = await Promise.all([
    read("src/app/admin/(protected)/reviews/page.tsx"),
    read("src/components/admin/AdminReviewManager.tsx"),
    read("src/components/admin/review-manager/AdminReviewCardView.tsx"),
  ]);

  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"reviews",\s*"update"/,
  );
  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"reviews",\s*"delete"/,
  );
  assert.match(manager, /canUpdate\?: boolean/);
  assert.match(manager, /canDelete\?: boolean/);
  assert.match(view, /canUpdate = true/);
  assert.match(view, /canDelete = true/);
  assert.match(view, /canUpdate \|\| canDelete/);
  assert.match(view, /조회 전용 권한/);
});
