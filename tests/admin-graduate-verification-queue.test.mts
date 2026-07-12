import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/admin/(protected)/graduate-verifications/page.tsx", import.meta.url);

test("수료생 검토 페이지는 사진 변경 대기열을 전용 관리자 화면으로 분리한다", async () => {
  const pageSource = await readFile(pagePath, "utf8");

  assert.doesNotMatch(pageSource, /member_profile_images/);
  assert.doesNotMatch(pageSource, /approveGraduateProfileImageAction/);
  assert.match(pageSource, /graduate_verification_requests/);
});
