import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home starts the partner directory before awaiting promotion slides", async () => {
  const [page, content] = await Promise.all([
    readFile(
      new URL("../src/app/(site)/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/HomeContent.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  const directoryStart = page.indexOf(
    "const directoryPromise = loadHomePartnerDirectoryState",
  );
  const promotionAwait = page.indexOf(
    "const resolvedPromotionSlides = await getHomePromotionSlides",
  );

  assert.ok(directoryStart >= 0);
  assert.ok(promotionAwait > directoryStart);
  assert.match(page, /directoryPromise=\{directoryPromise\}/);
  assert.match(content, /directoryPromise \?\?/);
});
