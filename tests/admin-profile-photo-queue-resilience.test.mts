import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("프로필 사진 검토 큐는 불러오기 실패를 안전한 재시도 상태로 복구한다", async () => {
  const [pageSource, viewSource, readModelSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/profile-photos/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminProfilePhotoReviewQueue.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-profile-photo-queue.server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(pageSource, /throw new Error/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.match(pageSource, /getAdminProfilePhotoReplacementQueueReadModel/);
  assert.match(pageSource, /currentPhotosPromise/);
  assert.match(readModelSource, /getSupabaseAdminClient/);
  assert.match(readModelSource, /member_profile_images/);
  assert.match(readModelSource, /getAdminCurrentProfilePhotoQueueReadModel/);
  assert.match(pageSource, /queueLoadError/);
  assert.match(viewSource, /프로필 사진 검토 큐를 불러오지 못했습니다/);
  assert.match(viewSource, /loadError/);
  assert.match(viewSource, /<Suspense/);
  assert.match(viewSource, /await currentPhotosPromise/);
  assert.doesNotMatch(viewSource, /<h3 className="truncate/);
  assert.doesNotMatch(viewSource, /Photo replacement|Current photo review/);
});
