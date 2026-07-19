import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/image-upload/policy.ts");

test("공통 이미지 선택 정책은 HEIC/HEIF를 명시적으로 허용한다", async () => {
  const {
    IMAGE_SOURCE_ACCEPT,
    validateImageUploadSource,
  } = await modulePromise;

  assert.match(IMAGE_SOURCE_ACCEPT, /image\/heic/);
  assert.match(IMAGE_SOURCE_ACCEPT, /image\/heif/);
  assert.match(IMAGE_SOURCE_ACCEPT, /\.heic/);
  assert.equal(
    validateImageUploadSource({
      name: "iphone-photo.HEIC",
      type: "",
      size: 1024,
    }),
    null,
  );
  assert.match(
    validateImageUploadSource({
      name: "document.pdf",
      type: "application/pdf",
      size: 1024,
    }) ?? "",
    /이미지/,
  );
});

test("역할별 공통 WebP 정책은 기존 출력 규격을 유지한다", async () => {
  const { resolveImageTransformPolicy } = await modulePromise;

  assert.deepEqual(
    resolveImageTransformPolicy("partner", "thumbnail"),
    {
      key: "partner-thumbnail",
      purpose: "partner",
      role: "thumbnail",
      width: 1200,
      height: 1200,
      aspectRatio: 1,
      quality: 78,
      maxSourceBytes: 5 * 1024 * 1024,
      maxInputPixels: 25_000_000,
      maxOutputBytes: 5 * 1024 * 1024,
      fit: "cover",
    },
  );

  const review = resolveImageTransformPolicy("review", "image");
  assert.equal(review.width, 900);
  assert.equal(review.height, 900);
  assert.equal(review.quality, 68);
  assert.equal(review.maxSourceBytes, 2 * 1024 * 1024);

  const profile = resolveImageTransformPolicy("profile", "profile");
  assert.equal(profile.width, 640);
  assert.equal(profile.height, 640);
  assert.equal(profile.quality, 82);

  const signupProfile = resolveImageTransformPolicy("member-signup-profile", "profile");
  assert.equal(signupProfile.width, 640);
  assert.equal(signupProfile.height, 640);
  assert.equal(signupProfile.quality, 82);
  assert.equal(signupProfile.key, "member-signup-profile-profile");
});

test("공통 manifest는 기존 URL과 업로드 ID를 섞어 안전하게 해석한다", async () => {
  const { parseImageUploadManifest } = await modulePromise;

  const manifest = parseImageUploadManifest(
    JSON.stringify({
      thumbnail: { kind: "upload", uploadId: "b0b491e3-9ef2-4e22-b51a-90c604e3d96f" },
      gallery: [
        { kind: "existing", url: "https://example.com/existing.webp" },
        { kind: "upload", uploadId: "03f5459b-dfee-4558-907a-509a396312f5" },
      ],
    }),
  );

  assert.equal(manifest?.thumbnail?.kind, "upload");
  assert.equal(manifest?.thumbnail?.uploadId, "b0b491e3-9ef2-4e22-b51a-90c604e3d96f");
  assert.equal(manifest?.gallery[1]?.kind, "upload");
  assert.equal(parseImageUploadManifest("{invalid"), null);
});

test("업무 저장 경계는 기존에 저장된 URL 외의 existing 항목을 거부한다", async () => {
  const { assertExistingImageManifestUrls } = await modulePromise;
  const existingUrl = "https://cdn.example.com/partner/current.webp";

  assert.doesNotThrow(() =>
    assertExistingImageManifestUrls(
      [{ kind: "existing", url: existingUrl }],
      [existingUrl],
    ),
  );
  assert.throws(
    () =>
      assertExistingImageManifestUrls(
        [{ kind: "existing", url: "https://attacker.example/new-image.webp" }],
        [existingUrl],
      ),
    /기존에 저장된 이미지/,
  );
});

test("업로드 서명 수명은 10분으로 계산하고 경계 시각부터 만료로 처리한다", async () => {
  const {
    getImageUploadSignedUrlExpiresAt,
    isImageUploadSignedUrlExpired,
  } = await import("../src/lib/image-upload/repository.ts");
  const signedAt = new Date("2026-07-18T12:00:00.000Z");
  const expiresAt = getImageUploadSignedUrlExpiresAt(signedAt);

  assert.equal(expiresAt.toISOString(), "2026-07-18T12:10:00.000Z");
  assert.equal(isImageUploadSignedUrlExpired(expiresAt, new Date("2026-07-18T12:09:59.999Z")), false);
  assert.equal(isImageUploadSignedUrlExpired(expiresAt, new Date("2026-07-18T12:10:00.000Z")), true);
});
