import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("프로필 사진 검토 큐는 첫 제출 사진 외 미리보기를 지연 로드한다", async () => {
  const component = await readFile(
    new URL(
      "../src/components/admin/AdminProfilePhotoReviewQueue.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(component, /loading = "lazy"/);
  assert.match(component, /loading=\{loading\}/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /loading=\{index === 0 \? "eager" : "lazy"\}/);
});
