import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const badge = readFileSync(
  new URL("../public/apple-wallet-add-to-wallet-ko.svg", import.meta.url),
);
const cardSource = readFileSync(
  new URL(
    "../src/components/certification/AppleWalletPassCard.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("uses the unmodified Apple-provided Korean web badge", () => {
  assert.equal(
    createHash("sha256").update(badge).digest("hex"),
    "2673e765c45c8ab6466ae7ac26289eacf161bfdda75e324992ca239056468fe9",
  );
  assert.match(
    cardSource,
    /src="\/apple-wallet-add-to-wallet-ko\.svg"/,
  );
  assert.match(cardSource, /alt=""/);
  assert.match(cardSource, /aria-label=\{primaryLabel\}/);
});
