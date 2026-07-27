import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 미디어·토큰·쿠폰 조작은 44px 터치 영역을 사용한다", async () => {
  const sources = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/partner-media-editor/MediaField.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/token-chip-field/TokenChipItems.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/ad-packages/AdminPartnerCouponManager.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  const source = sources.join("\n");
  assert.match(source, /inline-flex h-11 w-11 shrink-0/);
  assert.match(source, /h-11 w-11 min-h-11 min-w-11/);
  assert.match(source, /summary className="flex min-h-11/);
  assert.doesNotMatch(source, /h-9 w-9/);
  assert.doesNotMatch(source, /h-10 w-10 min-h-10 min-w-10/);
});
