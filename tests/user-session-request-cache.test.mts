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
    /\.select\(\s*"id,auth_session_version,must_change_password,email_verified_at,mattermost_login_disabled_at",?\s*\)/,
  );
  assert.match(
    source,
    /requiresEmailRegistration: requiresMemberEmailRegistration\(\{[\s\S]*?mattermostLoginDisabledAt: data\.mattermost_login_disabled_at,[\s\S]*?emailVerifiedAt: data\.email_verified_at,[\s\S]*?\}\)/,
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

test("member gate reads active policy versions without bodies and skips consent rows for a fresh snapshot", () => {
  const source = readFileSync(
    new URL("../src/lib/user-auth.ts", import.meta.url),
    "utf8",
  );
  const getUserSessionSource = source.slice(
    source.indexOf("export const getUserSession = cache"),
  );

  assert.match(getUserSessionSource, /getActiveRequiredPolicyVersions\(\)/);
  assert.doesNotMatch(getUserSessionSource, /getActiveRequiredPolicies\(\)/);
  assert.match(
    getUserSessionSource,
    /const eagerConsentVersionsPromise = policyConsentSnapshot\s*\?\s*null\s*:\s*getMemberPolicyConsentVersions\(session\.userId\)/,
  );
  assert.match(
    getUserSessionSource,
    /isPolicyConsentSnapshotFresh\([\s\S]*?\)\s*\?\s*false\s*:\s*evaluateRequiredPolicyVersionStatus\(/,
  );

  const policySource = readFileSync(
    new URL("../src/lib/policy-documents.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(policySource, /const POLICY_VERSION_SELECT = "kind,version";/);
  assert.match(
    policySource,
    /export const getActiveRequiredPolicyVersions = cache\(\s*queryActiveRequiredPolicyVersions,?\s*\)/,
  );
});
