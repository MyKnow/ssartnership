import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("places Apple's required trademark credit with the site legal information", () => {
  const footerSource = readFileSync(
    new URL("../src/components/Footer.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    footerSource,
    /Apple, Apple Watch, iPhone, and iPod touch are trademarks of Apple\s+Inc\., registered in the U\.S\. and other countries\./,
  );
});
