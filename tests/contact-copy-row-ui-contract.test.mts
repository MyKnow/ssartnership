import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("연락처 복사 버튼은 hover 이동 시 잘리지 않고 긴 값은 말줄임된다", async () => {
  const source = await readFile(
    new URL("../src/components/ContactCopyRow.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /"flex items-center gap-2 overflow-visible border border-border bg-surface-muted"/,
  );
  assert.doesNotMatch(
    source,
    /"flex items-center gap-2 overflow-hidden border border-border bg-surface-muted"/,
  );
  assert.match(source, /"min-w-0 flex-1 truncate/);
});
