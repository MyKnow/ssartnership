import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/components/review-media/shared.ts");

test("리뷰 이미지도 공통 staging 완료 후 uploadId만 제출 manifest에 남긴다", async () => {
  const {
    buildReviewMediaManifestEntries,
    getPendingReviewMediaUploads,
    markReviewMediaUploadsReady,
  } = await modulePromise;
  const file = new File(["webp"], "review.webp", { type: "image/webp" });
  const items = [{
    id: "review-1",
    kind: "file" as const,
    url: "blob:review",
    file,
  }];

  assert.deepEqual(getPendingReviewMediaUploads(items), [{
    clientId: "review-1",
    role: "image",
    file,
  }]);

  const completed = markReviewMediaUploadsReady(items, new Map([
    ["review-1", "03f5459b-dfee-4558-907a-509a396312f5"],
  ]));
  assert.deepEqual(buildReviewMediaManifestEntries(completed), [{
    kind: "upload",
    uploadId: "03f5459b-dfee-4558-907a-509a396312f5",
  }]);
  assert.equal(completed[0]?.kind, "file");
  if (completed[0]?.kind === "file") {
    assert.equal(completed[0].file, file);
  }
});
