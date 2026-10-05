import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { encodeCanvasAsIntermediateWebp } from "../src/lib/image-upload/client-webp.ts";
import {
  CLIENT_INTERMEDIATE_WEBP_QUALITY,
  getClientIntermediateWebpQualities,
  resolveImageTransformPolicy,
} from "../src/lib/image-upload/policy.ts";

function fakeCanvas(sizeForQuality: (quality: number) => number | null) {
  const calls: number[] = [];
  const canvas = {
    toBlob(callback: (blob: Blob | null) => void, type: string, quality: number) {
      assert.equal(type, "image/webp");
      calls.push(quality);
      const size = sizeForQuality(quality);
      callback(size === null ? null : new Blob([new Uint8Array(size)], { type }));
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

test("중간 WebP 품질은 정책 품질보다 높게 시작하고 마지막 후보는 정책 품질이다", () => {
  assert.equal(CLIENT_INTERMEDIATE_WEBP_QUALITY, 0.92);
  assert.deepEqual(getClientIntermediateWebpQualities(0.68), [0.92, 0.68]);
  assert.deepEqual(getClientIntermediateWebpQualities(0.78), [0.92, 0.78]);
  assert.deepEqual(getClientIntermediateWebpQualities(0.95), [0.95]);
  assert.deepEqual(getClientIntermediateWebpQualities(1.4), [1]);
  assert.deepEqual(getClientIntermediateWebpQualities(Number.NaN), [0.92]);

  for (const [purpose, role] of [
    ["review", "image"],
    ["profile", "profile"],
    ["partner", "gallery"],
    ["showcase-project", "image"],
  ] as const) {
    const policy = resolveImageTransformPolicy(purpose, role);
    const qualities = getClientIntermediateWebpQualities(policy.quality / 100);
    assert.equal(qualities.at(-1), policy.quality / 100, policy.key);
    assert.ok(qualities[0]! > policy.quality / 100, policy.key);
  }
});

test("중간 파일이 원본 상한 안이면 높은 품질 한 번만 인코딩한다", async () => {
  const { canvas, calls } = fakeCanvas(() => 1_000);
  const blob = await encodeCanvasAsIntermediateWebp(canvas, {
    finalQuality: 0.68,
    maxBytes: 2_000,
    failureMessage: "실패",
  });

  assert.equal(blob.size, 1_000);
  assert.deepEqual(calls, [0.92]);
});

test("중간 파일이 원본 상한을 넘으면 정책 품질로 다시 인코딩한다", async () => {
  const { canvas, calls } = fakeCanvas((quality) => (quality > 0.9 ? 3_000 : 1_500));
  const blob = await encodeCanvasAsIntermediateWebp(canvas, {
    finalQuality: 0.68,
    maxBytes: 2_000,
    failureMessage: "실패",
  });

  assert.equal(blob.size, 1_500);
  assert.deepEqual(calls, [0.92, 0.68]);
});

test("브라우저가 WebP 인코딩을 돌려주지 못하면 사용자 문구로 실패한다", async () => {
  const { canvas } = fakeCanvas(() => null);
  await assert.rejects(
    encodeCanvasAsIntermediateWebp(canvas, { finalQuality: 0.78, failureMessage: "이미지 변환에 실패했습니다." }),
    /이미지 변환에 실패했습니다/,
  );
});

test("크롭 다이얼로그와 HEIC 디코드가 같은 중간 인코딩 헬퍼를 쓰고 리뷰 크롭은 무시되던 품질 prop을 넘기지 않는다", async () => {
  const [dialog, clientTransform, reviewModal] = await Promise.all(
    [
      "../src/components/media/ImageCropDialog.tsx",
      "../src/lib/image-upload/client-transform.ts",
      "../src/components/review-media/ReviewImageCropModal.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of [dialog, clientTransform]) {
    assert.match(source, /encodeCanvasAsIntermediateWebp\(canvas, \{/);
    assert.doesNotMatch(source, /canvas\.toBlob\(/);
  }
  assert.match(dialog, /maxBytes: policy\?\.maxSourceBytes/);
  assert.match(clientTransform, /maxBytes: policy\.maxSourceBytes/);
  assert.doesNotMatch(reviewModal, /quality=/);
  assert.match(reviewModal, /policy=\{REVIEW_IMAGE_POLICY\}/);
});
