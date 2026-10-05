import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const policyPromise = import("../src/lib/image-upload/policy.ts");
const transformPromise = import("../src/lib/image-upload/transform.server.ts");

async function createJpeg(seed: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 1600,
      height: 1200,
      channels: 3,
      background: { r: seed * 20, g: 82, b: 150 },
    },
  })
    .jpeg()
    .toBuffer();
}

test("업로드 정규화는 프로세스 단위로 동시 2개까지만 실행하고 나머지는 대기시킨다", async () => {
  const [{ resolveImageTransformPolicy }, transform] = await Promise.all([
    policyPromise,
    transformPromise,
  ]);
  const policy = resolveImageTransformPolicy("partner", "thumbnail");
  const sources = await Promise.all(Array.from({ length: 5 }, (_, index) => createJpeg(index)));

  assert.equal(transform.IMAGE_UPLOAD_NORMALIZE_CONCURRENCY, 2);
  const runs = sources.map((source: Buffer) =>
    transform.normalizeImageUpload({ source, declaredContentType: "image/jpeg", policy }),
  );
  await Promise.resolve();
  assert.deepEqual(transform.getImageUploadNormalizeLoad(), { active: 2, pending: 3 });

  const results = await Promise.all(runs);
  assert.equal(results.length, 5);
  for (const result of results) {
    assert.equal(result.contentType, "image/webp");
  }
  assert.deepEqual(transform.getImageUploadNormalizeLoad(), { active: 0, pending: 0 });
});

test("실패한 정규화도 슬롯을 돌려주고 다음 업로드가 진행된다", async () => {
  const [{ resolveImageTransformPolicy }, transform] = await Promise.all([
    policyPromise,
    transformPromise,
  ]);
  const policy = resolveImageTransformPolicy("partner", "thumbnail");
  const broken = Array.from({ length: 3 }, () =>
    transform.normalizeImageUpload({
      source: Buffer.from("not-an-image", "utf8"),
      declaredContentType: "image/png",
      policy,
    }),
  );

  // 거부 처리기를 곧바로 붙여 대기 중인 실패가 처리되지 않은 거부로 잡히지 않게 한다.
  const settled = await Promise.allSettled(broken);
  for (const result of settled) {
    assert.equal(result.status, "rejected");
    assert.match(String((result as PromiseRejectedResult).reason), /이미지/);
  }
  const ok = await transform.normalizeImageUpload({
    source: await createJpeg(1),
    declaredContentType: "image/jpeg",
    policy,
  });
  assert.equal(ok.contentType, "image/webp");
  assert.deepEqual(transform.getImageUploadNormalizeLoad(), { active: 0, pending: 0 });
});

test("모듈 초기화는 libvips 연산 캐시를 끄고 이미지당 스레드를 1개로 한 번만 설정한다", async () => {
  const transform = await transformPromise;
  const cache = sharp.cache();

  assert.equal(sharp.concurrency(), 1);
  assert.equal(cache.memory.max, 0);
  assert.equal(cache.files.max, 0);
  assert.equal(cache.items.max, 0);

  const calls: string[] = [];
  transform.configureSharpRuntime({
    cache: (() => {
      calls.push("cache");
      return cache;
    }) as typeof sharp.cache,
    concurrency: (() => {
      calls.push("concurrency");
      return 1;
    }) as typeof sharp.concurrency,
  });
  assert.deepEqual(calls, [], "이미 설정된 프로세스에서는 다시 적용하지 않는다");

  const source = await readFile(
    new URL("../src/lib/image-upload/transform.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /normalizeLimiter\.run\(\(\) => normalizeImageBuffer\(input\)\)/);
});
