import assert from "node:assert/strict";
import test from "node:test";

test("기존 프로모션 카드는 저장된 이미지 또는 완료된 공통 업로드만 사용할 수 있다", async () => {
  const { assertPromotionSlideImageSource } = await import(
    "../src/lib/promotions/image-source.ts"
  );
  const existingImageSrc = "https://cdn.example.com/promotions/current.webp";

  assert.doesNotThrow(() => assertPromotionSlideImageSource({
    imageSrc: existingImageSrc,
    existingImageSrc,
    uploadId: null,
  }));
  assert.doesNotThrow(() => assertPromotionSlideImageSource({
    imageSrc: "blob:local-preview",
    existingImageSrc,
    uploadId: "03f5459b-dfee-4558-907a-509a396312f5",
  }));
  assert.throws(
    () => assertPromotionSlideImageSource({
      imageSrc: "https://attacker.example/new.webp",
      existingImageSrc,
      uploadId: null,
    }),
    /기존에 저장된 이미지/,
  );
});
