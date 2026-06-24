import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resetVerifyRoutePath = new URL(
  "../src/app/api/ssafy/reset-password/route.ts",
  import.meta.url,
);
const resetFormPath = new URL(
  "../src/components/auth/ResetPasswordForm.tsx",
  import.meta.url,
);
const resetCompletePagePath = new URL(
  "../src/app/auth/reset/complete/page.tsx",
  import.meta.url,
);
const resetCompleteFormPath = new URL(
  "../src/components/auth/ResetPasswordCompleteForm.tsx",
  import.meta.url,
);
const resetCompleteApiPath = new URL(
  "../src/app/api/mm/_shared/reset-password-complete.ts",
  import.meta.url,
);

test("SSAFY reset verification stores completion state in an HttpOnly cookie", async () => {
  const route = await readFile(resetVerifyRoutePath, "utf8");

  assert.match(route, /RESET_PASSWORD_COMPLETION_COOKIE_NAME/);
  assert.match(route, /getResetPasswordCompletionCookieOptions/);
  assert.match(route, /response\.cookies\.set/);
  assert.doesNotMatch(route, /completionToken,\s*\n/);
});

test("reset password UI never exposes completion tokens in URL or request body", async () => {
  const [verifyForm, completePage, completeForm] = await Promise.all([
    readFile(resetFormPath, "utf8"),
    readFile(resetCompletePagePath, "utf8"),
    readFile(resetCompleteFormPath, "utf8"),
  ]);

  assert.doesNotMatch(verifyForm, /completionToken/);
  assert.doesNotMatch(verifyForm, /reset\/complete\?token/);
  assert.match(verifyForm, /window\.location\.replace\("\/auth\/reset\/complete"\)/);

  assert.doesNotMatch(completePage, /searchParams/);
  assert.doesNotMatch(completePage, /token=\{/);
  assert.match(completePage, /cookies\(\)/);

  assert.doesNotMatch(completeForm, /token:/);
  assert.doesNotMatch(completeForm, /JSON\.stringify\(\{[\s\S]*\btoken\b/);
});

test("reset password completion API consumes same-origin cookie state", async () => {
  const route = await readFile(resetCompleteApiPath, "utf8");

  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /readResetPasswordCompletionTokenFromCookieHeader/);
  assert.doesNotMatch(route, /payload\.token/);
});
