import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("signed member session revalidation is memoized once per server request", () => {
  const source = readFileSync(
    new URL("../src/lib/user-auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ cache \} from "react"/);
  assert.match(
    source,
    /export const getSignedUserSession = cache\(async \(\) => \{[\s\S]*?getRawSignedUserSession\(\)[\s\S]*?\.from\("members"\)[\s\S]*?\}\);/,
  );
  assert.match(
    source,
    /export async function getUserSession\(\) \{[\s\S]*?await getSignedUserSession\(\)/,
  );
});
