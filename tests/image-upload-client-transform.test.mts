import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/image-upload/client-transform.ts");

test("HEIC/HEIF 브라우저 디코더 오류는 서버 변환 fallback으로 넘긴다", async () => {
  const { shouldUseServerImageTransformFallback } = await modulePromise;

  assert.equal(
    shouldUseServerImageTransformFallback(new Error("decoder initialization failed")),
    true,
  );
  assert.equal(
    shouldUseServerImageTransformFallback(new Error("사진 해상도는 최대 2,500만 픽셀까지 선택할 수 있습니다.")),
    false,
  );
  assert.equal(
    shouldUseServerImageTransformFallback(new Error("HEIC/HEIF 사진의 해상도를 확인하지 못했습니다. 다른 사진을 선택해 주세요.")),
    false,
  );
});
