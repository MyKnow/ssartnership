import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("제휴처 폼 필드 그룹은 오류 설명과 레이블을 연결한다", async () => {
  const source = await readFile(
    new URL("../src/components/partner-card-form/FieldGroup.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useId/);
  assert.match(source, /htmlFor=\{controlId\}/);
  assert.match(source, /"aria-describedby": describedBy/);
  assert.match(source, /<fieldset/);
  assert.match(source, /role="alert"/);
  assert.doesNotMatch(source, /return \(\s*<label className=/);
});
