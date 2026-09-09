import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mock auth demo entry uses a full document navigation instead of App Router RSC prefetch", async () => {
  const [buttonSource, authEntrySource] = await Promise.all([
    readFile(new URL("../src/components/ui/Button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/auth/AuthEntryViews.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(buttonSource, /reloadDocument\?: boolean;/);
  assert.match(buttonSource, /if \(isInternalHref\(href\) && !reloadDocument\)/);
  assert.match(
    authEntrySource,
    /<Button[\s\S]*?href=\{`\/auth\/mock\?returnTo=\$\{encodeURIComponent\(returnTo\)\}`\}[\s\S]*?reloadDocument[\s\S]*?>[\s\S]*?촬영용 데모 시작/,
  );
});
