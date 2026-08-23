import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("keeps the global footer free of Apple trademark credit until the Wallet pass UI is released", () => {
  const footerSource = readFileSync(
    new URL("../src/components/Footer.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    footerSource,
    /Apple, Apple Watch, iPhone, and iPod touch are trademarks of Apple\s+Inc\., registered in the U\.S\. and other countries\./,
  );
});
