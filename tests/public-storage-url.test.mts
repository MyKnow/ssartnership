import assert from "node:assert/strict";
import test from "node:test";
import { extractPublicStorageObjectPath } from "../src/lib/public-storage-url.ts";
import { extractPartnerMediaStoragePath } from "../src/lib/partner-media.ts";
import { extractPromotionSlideStoragePath } from "../src/lib/promotion-slide-storage.ts";
import { extractReviewMediaStoragePath } from "../src/lib/review-media.ts";

test("공개 Storage URL에서 bucket과 디코딩된 객체 경로를 추출한다", () => {
  const url =
    "https://project.supabase.co/storage/v1/object/public/review-media/path%20to/file.webp?version=1";

  assert.deepEqual(extractPublicStorageObjectPath(url), {
    bucket: "review-media",
    path: "path to/file.webp",
  });
});

test("공개 Storage 객체가 아닌 URL과 잘못 인코딩된 경로는 거절한다", () => {
  assert.equal(extractPublicStorageObjectPath("javascript:alert(1)"), null);
  assert.equal(extractPublicStorageObjectPath("https://example.com/image.webp"), null);
  assert.equal(
    extractPublicStorageObjectPath(
      "https://project.supabase.co/storage/v1/object/public/review-media/%E0%A4%A",
    ),
    null,
  );
});

test("도메인별 공개 media parser는 공통 추출 계약을 공유한다", () => {
  const url =
    "https://project.supabase.co/storage/v1/object/public/partner-media/partners/1/image.webp";
  const expected = {
    bucket: "partner-media",
    path: "partners/1/image.webp",
  };

  assert.deepEqual(extractPartnerMediaStoragePath(url), expected);
  assert.deepEqual(extractPromotionSlideStoragePath(url), expected);
  assert.deepEqual(extractReviewMediaStoragePath(url), expected);
});
