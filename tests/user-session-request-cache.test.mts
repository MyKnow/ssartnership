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
    /\.select\("id,auth_session_version,must_change_password"\)/,
  );
  assert.match(
    source,
    /export const getUserSession = cache\(async \(\) => \{[\s\S]*?await getSignedUserSession\(\)/,
  );
  const getUserSessionSource = source.slice(
    source.indexOf("export const getUserSession = cache"),
  );
  assert.doesNotMatch(
    getUserSessionSource,
    /\.from\("members"\)/,
    "getUserSession should reuse the member snapshot from signed-session revalidation",
  );
});

test("member profile photo state is memoized by member within one server request", () => {
  const source = readFileSync(
    new URL("../src/lib/member-profile-images.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ cache \} from "react"/);
  assert.match(
    source,
    /export const getMemberProfilePhotoState = cache\(async \(memberId: string\) => \{[\s\S]*?getMemberProfilePhotoStates\(\[memberId\]\)[\s\S]*?\}\);/,
  );
});
