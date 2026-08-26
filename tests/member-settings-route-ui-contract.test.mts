import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsPageUrl = new URL(
  "../src/app/(site)/settings/page.tsx",
  import.meta.url,
);
const navigationUrl = new URL("../src/lib/site-navigation.ts", import.meta.url);

test("회원 설정 화면은 로그인과 안전한 복귀 경로를 보존한다", async () => {
  const [page, navigation] = await Promise.all([
    readFile(settingsPageUrl, "utf8"),
    readFile(navigationUrl, "utf8"),
  ]);

  assert.match(page, /getSignedUserSession/);
  assert.match(page, /getMemberCanonicalProfile/);
  assert.match(page, /getMemberSettingsNavigation/);
  assert.match(page, /redirect\(`\/auth\/login\?returnTo=/);
  assert.match(page, /returnTo=\{settingsHref\}/);
  assert.match(navigation, /sanitizeReturnTo/);
  assert.match(navigation, /encodeURIComponent\(backHref\)/);
  assert.match(navigation, /isSettingsPath/);
});

test("설정 화면은 공용 헤더와 설정 전용 뷰를 렌더링한다", async () => {
  const page = await readFile(settingsPageUrl, "utf8");

  assert.match(page, /<SiteHeader initialSession=\{headerSession\} \/>/);
  assert.match(page, /<MemberSettingsView/);
  assert.match(page, /hasMattermostAccount=\{Boolean\(member\.mattermostAccountId\)\}/);
  assert.match(page, /emailVerified=\{Boolean\(member\.emailVerifiedAt\)\}/);
});
