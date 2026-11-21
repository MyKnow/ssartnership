import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("즐겨찾기 토글은 서버 응답으로 상태를 맞추고 force-dynamic 페이지 전체를 다시 렌더링하지 않는다", () => {
  const source = readFileSync(
    new URL("../src/components/partner-favorites/PartnerFavoriteButton.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, /useRouter/);
  assert.match(source, /setIsFavorited\(Boolean\(payload\?\.favorite \?\? nextFavorited\)\)/);
  assert.match(source, /if \(typeof payload\?\.count === "number"\) \{\s*setCount\(payload\.count\);/);
  assert.match(source, /onToggle\?\.\(!nextFavorited, previousCount\)/);
  assert.match(source, /onToggle\?\.\(Boolean\(payload\?\.favorite \?\? nextFavorited\), payload\?\.count\)/);
  assert.match(source, /disabled=\{isPending \|\| pending\}/);
});
