import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";

const policyPromise = import("../src/lib/image-upload/policy.ts");
const transformPromise = import("../src/lib/image-upload/transform.server.ts");

test("서버는 입력 이미지를 정책 크기의 메타데이터 없는 WebP로 재인코딩한다", async () => {
  const [{ resolveImageTransformPolicy }, { normalizeImageUpload }] = await Promise.all([
    policyPromise,
    transformPromise,
  ]);
  const source = await sharp({
    create: {
      width: 1600,
      height: 900,
      channels: 3,
      background: { r: 18, g: 82, b: 150 },
    },
  })
    .withMetadata({ exif: { IFD0: { Copyright: "synthetic" } } })
    .jpeg()
    .toBuffer();

  const result = await normalizeImageUpload({
    source,
    declaredContentType: "image/jpeg",
    policy: resolveImageTransformPolicy("partner", "thumbnail"),
  });
  const metadata = await sharp(result.buffer).metadata();

  assert.equal(result.contentType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 1200);
  assert.equal(metadata.exif, undefined);
  assert.equal(
    result.sha256,
    createHash("sha256").update(result.buffer).digest("hex"),
  );
});

test("서버는 손상된 이미지와 활성 SVG를 거부한다", async () => {
  const [{ resolveImageTransformPolicy }, { normalizeImageUpload }] = await Promise.all([
    policyPromise,
    transformPromise,
  ]);
  const policy = resolveImageTransformPolicy("promotion", "slide");

  await assert.rejects(
    normalizeImageUpload({
      source: Buffer.from("not-an-image", "utf8"),
      declaredContentType: "image/png",
      policy,
    }),
    /이미지/,
  );
  await assert.rejects(
    normalizeImageUpload({
      source: Buffer.from('<svg><script>alert(1)</script></svg>', "utf8"),
      declaredContentType: "image/svg+xml",
      policy,
    }),
    /SVG/,
  );
  await assert.rejects(
    normalizeImageUpload({
      source: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/image.png" /></svg>', "utf8"),
      declaredContentType: "image/svg+xml",
      policy,
    }),
    /SVG/,
  );
});

test("서버는 선언 MIME이 아닌 실제 이미지 바이트를 판별해 WebP로 재인코딩한다", async () => {
  const [{ resolveImageTransformPolicy }, { normalizeImageUpload }] = await Promise.all([
    policyPromise,
    transformPromise,
  ]);
  const source = await sharp({
    create: {
      width: 720,
      height: 480,
      channels: 3,
      background: { r: 120, g: 60, b: 180 },
    },
  }).png().toBuffer();

  const result = await normalizeImageUpload({
    source,
    declaredContentType: "image/jpeg",
    policy: resolveImageTransformPolicy("review", "image"),
  });

  assert.equal(result.sourceContentType, "image/png");
  assert.equal((await sharp(result.buffer).metadata()).format, "webp");
});

test("최종 연결 직전에는 staging WebP의 해시와 실제 크기를 다시 확인한다", async () => {
  const [{ resolveImageTransformPolicy }, { normalizeImageUpload, validateNormalizedImageUpload }] = await Promise.all([
    policyPromise,
    transformPromise,
  ]);
  const policy = resolveImageTransformPolicy("review", "image");
  const normalized = await normalizeImageUpload({
    source: await sharp({
      create: {
        width: 1000,
        height: 700,
        channels: 3,
        background: { r: 20, g: 120, b: 100 },
      },
    }).png().toBuffer(),
    declaredContentType: "image/png",
    policy,
  });

  await assert.doesNotReject(
    validateNormalizedImageUpload({
      source: normalized.buffer,
      policy,
      expectedSha256: normalized.sha256,
    }),
  );
  await assert.rejects(
    validateNormalizedImageUpload({
      source: normalized.buffer,
      policy,
      expectedSha256: "0".repeat(64),
    }),
    /무결성/,
  );
});

test("sharp가 읽지 못하는 HEIC/HEIF도 공통 디코더 fallback으로 WebP로 바꾼다", async () => {
  const [{ resolveImageTransformPolicy }, { normalizeImageBuffer }] = await Promise.all([
    policyPromise,
    import("../src/lib/image-upload/transform-core.ts"),
  ]);
  const data = new Uint8ClampedArray(4 * 4 * 4).fill(180);
  const box = (type: string, payload: Buffer) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length, 0);
    header.write(type, 4, "ascii");
    return Buffer.concat([header, payload]);
  };
  const dimensions = Buffer.alloc(12);
  dimensions.writeUInt32BE(4, 4);
  dimensions.writeUInt32BE(4, 8);
  const source = box("meta", Buffer.concat([
    Buffer.alloc(4),
    box("iprp", box("ipco", box("ispe", dimensions))),
  ]));

  const result = await normalizeImageBuffer({
    source,
    declaredContentType: "image/heic",
    policy: resolveImageTransformPolicy("profile", "profile"),
    decodeHeif: async () => ({ width: 4, height: 4, data }),
  });
  const metadata = await sharp(result.buffer).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 640);
});
