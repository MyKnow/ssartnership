import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const partnerDetailPagePath = new URL(
  "../src/app/(site)/partners/[id]/page.tsx",
  import.meta.url,
);

test("public partner detail missing data uses notFound instead of home redirect", async () => {
  const source = await readFile(partnerDetailPagePath, "utf8");

  assert.match(source, /import \{ notFound \} from "next\/navigation";/);
  assert.doesNotMatch(source, /redirect\("\/"\)/);
  assert.match(source, /if \(!pageData\) \{[\s\S]*?notFound\(\);/);
});
