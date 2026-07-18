import assert from "node:assert/strict";
import test from "node:test";

test("새 이미지 manifest는 완료된 공통 업로드 ID 없이는 허용하지 않는다", async () => {
  const [partnerMedia, reviewMedia] = await Promise.all([
    import("../src/lib/partner-media.ts"),
    import("../src/lib/review-media.ts"),
  ]);
  const uploadId = "03f5459b-dfee-4558-907a-509a396312f5";

  assert.equal(
    partnerMedia.parsePartnerMediaManifest(JSON.stringify({
      thumbnail: { kind: "upload" },
      gallery: [],
    })),
    null,
  );
  assert.equal(
    reviewMedia.parseReviewMediaManifest(JSON.stringify({
      images: [{ kind: "upload" }],
    })),
    null,
  );
  assert.deepEqual(
    partnerMedia.parsePartnerMediaManifest(JSON.stringify({
      thumbnail: { kind: "upload", uploadId },
      gallery: [],
    })),
    { thumbnail: { kind: "upload", uploadId }, gallery: [] },
  );
});

test("existing 이미지 항목은 편집 대상에 이미 저장된 URL만 유지할 수 있다", async () => {
  const [partnerMedia, reviewMedia] = await Promise.all([
    import("../src/lib/partner-media.ts"),
    import("../src/lib/review-media.ts"),
  ]);
  const currentUrl = "https://cdn.example.com/current.webp";
  const forgedUrl = "https://attacker.example/new.webp";
  const partnerManifest = partnerMedia.parsePartnerMediaManifest(JSON.stringify({
    thumbnail: { kind: "existing", url: forgedUrl },
    gallery: [],
  }));
  const reviewManifest = reviewMedia.parseReviewMediaManifest(JSON.stringify({
    images: [{ kind: "existing", url: forgedUrl }],
  }));

  assert.throws(
    () => partnerMedia.assertPartnerMediaExistingUrls(partnerManifest, [currentUrl]),
    /기존에 저장된 이미지/,
  );
  assert.throws(
    () => reviewMedia.assertReviewMediaExistingUrls(reviewManifest, [currentUrl]),
    /기존에 저장된 이미지/,
  );
  assert.doesNotThrow(() => partnerMedia.assertPartnerMediaExistingUrls(
    partnerMedia.parsePartnerMediaManifest(JSON.stringify({
      thumbnail: { kind: "existing", url: currentUrl },
      gallery: [],
    })),
    [currentUrl],
  ));
});

test("업무 저장 요청에는 이미지 File 바이너리를 포함할 수 없다", async () => {
  const { assertNoDirectImageFileSubmission } = await import("../src/lib/image-upload/policy.ts");
  const formData = new FormData();
  formData.set("thumbnailFile", new File(["image"], "brand.webp", { type: "image/webp" }));

  assert.throws(
    () => assertNoDirectImageFileSubmission(formData, ["thumbnailFile", "galleryFiles"]),
    /공통 업로드/,
  );
  assert.doesNotThrow(() => assertNoDirectImageFileSubmission(new FormData(), ["thumbnailFile"]));
});
