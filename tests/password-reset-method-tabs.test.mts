import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/auth/PasswordResetMethodTabs.tsx", import.meta.url),
  "utf8",
);
const graduateFormSource = await readFile(
  new URL("../src/components/auth/GraduatePasswordResetForm.tsx", import.meta.url),
  "utf8",
);

test("비밀번호 재설정은 Mattermost와 이메일 인증 수단만 노출한다", () => {
  assert.match(source, /grid-cols-2/);
  assert.match(source, /aria-label="비밀번호 재설정 인증 수단"/);
  assert.match(source, />\s*Mattermost\s*</);
  assert.match(source, />\s*이메일\s*</);
  assert.doesNotMatch(source, />\s*운영진·재학생\s*</);
  assert.doesNotMatch(source, />\s*수료생\s*</);
  assert.doesNotMatch(source, />\s*Mattermost 아이디\s*</);
  assert.doesNotMatch(source, /이메일 초대|manual_email|ManualMemberEmailResetForm/);
});

test("비밀번호 재설정 탭은 각 유형의 재설정 입력에 집중하고 수료생 복구를 별도 안내한다", () => {
  assert.doesNotMatch(source, /로그인 후 이메일 등록|\/auth\/login\?returnTo=%2Fcertification%2Femail/);
  assert.doesNotMatch(source, /기존 회원 복구 신청/);
  assert.match(source, /href="\/auth\/signup\/graduate\?kind=recovery"/);
  assert.match(source, />\s*수료해서 MM 로그인이 불가능해요\s*</);
  assert.equal(source.match(/\/auth\/signup\/graduate\?kind=recovery/g)?.length, 1);
  assert.doesNotMatch(
    source,
    /가입 때 연결한 Mattermost 계정으로 인증 코드를 받으면 새 비밀번호를 설정할 수 있습니다/,
  );
});

test("수료생 인증 CTA는 입력과 간격을 두고 전체 너비를 사용한다", () => {
  assert.match(graduateFormSource, /className="mt-2 grid gap-3"/);
  assert.equal(graduateFormSource.match(/className="w-full"/g)?.length, 2);
});

test("수료생 탭 안에서는 이메일 안내와 라벨을 간결하게 표시한다", () => {
  assert.match(
    graduateFormSource,
    /이메일로 6자리 인증 코드를 확인한 뒤 새 비밀번호 설정 링크를 보냅니다/,
  );
  assert.match(graduateFormSource, />\s*이메일\s*<Input/);
  assert.match(graduateFormSource, /placeholder="예시: myknow@example\.com"/);
  assert.match(graduateFormSource, /"이메일로 인증 코드 받기"/);
  assert.doesNotMatch(graduateFormSource, /수료생 이메일/);
});

test("비밀번호 재설정 탭은 표준 키보드 이동을 지원한다", () => {
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.match(source, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(source, /tabIndex=\{method === "mattermost" \? 0 : -1\}/);
  assert.match(source, /tabIndex=\{method === "graduate_email" \? 0 : -1\}/);
});
