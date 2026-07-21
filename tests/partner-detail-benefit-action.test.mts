import assert from "node:assert/strict";
import test from "node:test";

const pageSourcePromise = import("node:fs/promises").then(({ readFile }) =>
  readFile(
    new URL("../src/app/(site)/partners/[id]/page.tsx", import.meta.url),
    "utf8",
  ),
);

test("offline benefit action is hidden only for ineligible viewers", async () => {
  const source = await pageSourcePromise;

  assert.match(
    source,
    /getPartnerServiceMode\(partner\.location\) === "offline"\s*&&\s*partner\.benefitAccessStatus !== "not_eligible"\s*&&\s*partner\.benefits\.length > 0/,
  );
  assert.match(source, /requiresLogin: partner\.benefitAccessStatus === "login_required"/);
});
