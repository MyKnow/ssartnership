import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("프로필 사진 검토 큐는 조회·수정 권한에 맞춰 작업을 노출한다", async () => {
  const [page, view] = await Promise.all([
    read("src/app/admin/(protected)/profile-photos/page.tsx"),
    read("src/components/admin/AdminProfilePhotoReviewQueue.tsx"),
  ]);

  assert.match(
    page,
    /canAdmin\(\s*session\.account\.permissions,\s*"profile_images",\s*"update"/,
  );
  assert.match(page, /canUpdate=\{canAdmin/);
  assert.match(view, /canUpdate = true/);
  assert.match(view, /canUpdate \?/);
  assert.match(view, /조회 전용 권한/);
});
