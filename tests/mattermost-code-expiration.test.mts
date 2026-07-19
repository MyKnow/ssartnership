import assert from "node:assert/strict";
import test from "node:test";

type MattermostCodeExpirationModule = typeof import("../src/lib/mattermost-code-expiration.ts");

const expirationModulePromise = import(
  new URL("../src/lib/mattermost-code-expiration.ts", import.meta.url).href,
) as Promise<MattermostCodeExpirationModule>;

test("Mattermost 인증 코드는 5분 만료와 두 자리 MM:SS 표시를 사용한다", async () => {
  const {
    MATTERMOST_VERIFICATION_CODE_TTL_SECONDS,
    getMattermostCodeExpiresAt,
    getMattermostCodeRemainingSeconds,
    formatMattermostCodeRemainingTime,
  } = await expirationModulePromise;

  assert.equal(MATTERMOST_VERIFICATION_CODE_TTL_SECONDS, 5 * 60);
  assert.equal(getMattermostCodeExpiresAt(300, 1_000), 301_000);
  assert.equal(getMattermostCodeExpiresAt(undefined, 1_000), 301_000);
  assert.equal(getMattermostCodeRemainingSeconds(301_000, 1_000), 300);
  assert.equal(getMattermostCodeRemainingSeconds(301_000, 300_001), 1);
  assert.equal(getMattermostCodeRemainingSeconds(301_000, 301_000), 0);
  assert.equal(formatMattermostCodeRemainingTime(300), "05:00");
  assert.equal(formatMattermostCodeRemainingTime(59), "00:59");
  assert.equal(formatMattermostCodeRemainingTime(0), "00:00");
});
