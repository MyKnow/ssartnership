import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AD_COUPON_CODE_BATCH_LIMIT,
  AD_COUPON_CODE_MAX_LENGTH,
  assertValidAdCouponCodeBatch,
} from "../src/lib/ad-coupon-domain.ts";

test("쿠폰 코드 batch 계약은 개수와 코드 길이를 저장소 경계에서 제한한다", () => {
  assert.doesNotThrow(() =>
    assertValidAdCouponCodeBatch([
      "A".repeat(AD_COUPON_CODE_MAX_LENGTH),
    ]),
  );
  assert.throws(
    () =>
      assertValidAdCouponCodeBatch(
        Array.from(
          { length: AD_COUPON_CODE_BATCH_LIMIT + 1 },
          (_, index) => `CODE-${index}`,
        ),
      ),
    /20,000개/,
  );
  assert.throws(
    () =>
      assertValidAdCouponCodeBatch([
        "A".repeat(AD_COUPON_CODE_MAX_LENGTH + 1),
      ]),
    /120자/,
  );
});

test("Supabase 코드 등록은 동기 해시와 bounded DB batch upsert를 사용한다", async () => {
  const source = await readFile(
    new URL(
      "../src/lib/repositories/supabase/ad-package-repository.supabase.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /const AD_COUPON_CODE_WRITE_BATCH_SIZE = 1_000;/);
  assert.match(source, /createHash\("sha256"\)\.update\(code\)\.digest\("hex"\)/);
  assert.match(source, /\.upsert\(rows, \{/);
  assert.match(source, /onConflict: "coupon_id,code_hash"/);
  assert.match(source, /ignoreDuplicates: true/);
  assert.doesNotMatch(source, /crypto\.subtle\.digest/);
  assert.doesNotMatch(source, /\.in\("code", uniqueCodes\)/);
});
