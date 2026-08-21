import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("리뷰 검수 카드는 핵심 본문과 결정 액션을 보조 정보보다 먼저 보여준다", async () => {
  const [source, detailSource, gallerySource] = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/review-manager/AdminReviewCardView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/review-manager/AdminReviewDetailDisclosure.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/review-manager/AdminReviewImageGallery.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(source, /<AdminReviewDetailDisclosure/);
  assert.match(detailSource, /리뷰 내용·작성자 정보/);
  assert.match(detailSource, /\/api\/admin\/reviews\//);
  assert.match(detailSource, /<AdminReviewImageGallery images=\{detail\.images\}/);
  assert.match(gallerySource, /loading="lazy"/);
});

test("리뷰 큐 필터는 선택할 때만 목적지로 이동한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/admin/AdminReviewQueueFilters.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /<Link\s+href=\{getHref\(\)\}\s+prefetch=\{false\}/,
  );
  assert.match(
    source,
    /href=\{getHref\(option\.value\)\}\s+prefetch=\{false\}/,
  );
});
