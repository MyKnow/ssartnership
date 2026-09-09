import assert from "node:assert/strict";
import test from "node:test";

import { getPushDeviceLabel } from "../src/lib/push/device-label.ts";

test("client hints 가 포함된 Chrome Android user agent 를 일관되게 해석한다", () => {
  assert.equal(
    getPushDeviceLabel(
      'Mozilla/5.0 client-hints="Google Chrome";v="139", "Chromium";v="139"; Android; ?1',
    ),
    "Chrome · Android",
  );
});

test("Safari iPhone user agent 를 일관되게 해석한다", () => {
  assert.equal(
    getPushDeviceLabel(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ),
    "Safari · iOS",
  );
});

test("정보가 부족한 user agent 는 중립 라벨로 처리한다", () => {
  assert.equal(getPushDeviceLabel(null), "브라우저 · 기기");
});
