import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PIN_INPUT_FILES = [
  "src/components/partner/PartnerBenefitVerificationView.tsx",
  "src/components/coupons/CouponPartnerVerificationView.tsx",
];

function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("제휴처 확인 PIN 입력은 비밀번호 저장 대상이 되지 않는 text 입력으로 가린다", async () => {
  const css = await readSource("src/app/globals.css");
  assert.match(css, /\.pin-mask \{\s*-webkit-text-security: disc;/);

  for (const path of PIN_INPUT_FILES) {
    const source = await readSource(path);
    const input = source.match(/<input[\s\S]*?placeholder="4자리 PIN 입력"[\s\S]*?\/>/)?.[0];
    assert.ok(input, path);
    assert.match(input, /type="text"/, path);
    assert.match(input, /inputMode="numeric"/, path);
    assert.match(input, /autoComplete="off"/, path);
    assert.match(input, /className="pin-mask /, path);
    assert.doesNotMatch(input, /type="password"/, path);
    assert.doesNotMatch(input, /(?:name|id)="[^"]*(?:[Pp]assword|[Pp]in)"/, path);
  }
});
