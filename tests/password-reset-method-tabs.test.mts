import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/auth/PasswordResetMethodTabs.tsx", import.meta.url),
  "utf8",
);

test("비밀번호 재설정은 운영진·재학생과 수료생 경로만 노출한다", () => {
  assert.match(source, /grid-cols-2/);
  assert.match(source, />\s*운영진·재학생\s*</);
  assert.match(source, />\s*수료생\s*</);
  assert.doesNotMatch(source, /이메일 초대|manual_email|ManualMemberEmailResetForm/);
});

test("비밀번호 재설정 탭은 표준 키보드 이동을 지원한다", () => {
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.match(source, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(source, /tabIndex=\{method === "mattermost" \? 0 : -1\}/);
  assert.match(source, /tabIndex=\{method === "graduate_email" \? 0 : -1\}/);
});
