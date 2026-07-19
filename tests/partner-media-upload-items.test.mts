import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/components/admin/partner-media-editor/utils.ts");

test("편집 완료 이미지에는 uploadId만 manifest에 남기고 File은 제출 대상에서 제외한다", async () => {
  const {
    getPendingMediaUploads,
    markMediaUploadsReady,
    manifestForItems,
  } = await modulePromise;
  const file = new File(["webp"], "thumbnail.webp", { type: "image/webp" });
  const items = [{
    id: "thumbnail-1",
    kind: "file" as const,
    url: "blob:preview",
    file,
  }];

  assert.deepEqual(getPendingMediaUploads(items, "thumbnail"), [{
    clientId: "thumbnail-1",
    role: "thumbnail",
    file,
  }]);

  const completed = markMediaUploadsReady(items, new Map([
    ["thumbnail-1", "03f5459b-dfee-4558-907a-509a396312f5"],
  ]));
  assert.deepEqual(getPendingMediaUploads(completed, "thumbnail"), []);
  assert.deepEqual(manifestForItems(completed), [{
    kind: "upload",
    uploadId: "03f5459b-dfee-4558-907a-509a396312f5",
  }]);
  assert.equal(completed[0]?.file, file);
  assert.equal(completed[0]?.url, "blob:preview");
});
