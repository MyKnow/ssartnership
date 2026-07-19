import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/form-idempotency.ts");
const idempotencyKey = "03f5459b-dfee-4558-907a-509a396312f5";

test("폼 멱등성 키는 단일 UUID만 허용하고 정규화한다", async () => {
  const { readFormIdempotencyKey } = await modulePromise;
  const formData = new FormData();
  formData.set("idempotencyKey", idempotencyKey.toUpperCase());

  assert.equal(readFormIdempotencyKey(formData), idempotencyKey);
});

test("폼 멱등성 키는 중복 값과 파일 값을 거부한다", async () => {
  const { readFormIdempotencyKey } = await modulePromise;
  const duplicate = new FormData();
  duplicate.append("idempotencyKey", idempotencyKey);
  duplicate.append("idempotencyKey", idempotencyKey);
  assert.equal(readFormIdempotencyKey(duplicate), null);

  const file = new FormData();
  file.set("idempotencyKey", new File(["key"], "key.txt"));
  assert.equal(readFormIdempotencyKey(file), null);
});
