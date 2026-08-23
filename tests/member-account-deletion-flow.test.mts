import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("설정의 로그아웃은 앱 내 확인 모달을 열고 탈퇴는 경고 화면으로 이동한다", () => {
  const actions = read(
    "src/components/certification/CertificationFooterActions.tsx",
  );

  assert.match(actions, /<Modal[\s\S]+title="로그아웃하시겠습니까\?"/);
  assert.match(actions, /description="이 기기에서 현재 계정의 세션을 종료합니다\."/);
  assert.match(actions, /onClick=\{\(\) => setLogoutConfirmationOpen\(true\)\}/);
  assert.match(actions, /href=\{deletionHref\}/);
  assert.doesNotMatch(actions, /window\.confirm/);
  assert.doesNotMatch(actions, /\/api\/mm\/delete/);
});

test("회원 탈퇴 경고 화면은 최종 모달 확인 후에만 동일 출처 탈퇴 API를 호출한다", () => {
  const view = read("src/components/settings/MemberAccountDeletionView.tsx");
  const page = read("src/app/(site)/settings/delete-account/page.tsx");
  const story = read(
    "src/components/settings/MemberAccountDeletionView.stories.tsx",
  );

  assert.match(view, /title="회원 탈퇴"/);
  assert.match(view, /회원 탈퇴 계속하기/);
  assert.match(view, /title="정말 탈퇴하시겠습니까\?"/);
  assert.doesNotMatch(
    view,
    /탈퇴 요청이 완료되면 현재 기기에서 로그아웃되고, 계정으로 제공되는 제휴 혜택 이용이 중지됩니다\./,
  );
  assert.match(view, /제휴 혜택 이용이 즉시 중지됩니다\./);
  assert.equal(
    view.match(/개인 식별 정보와 프로필 사진은 30일 후 익명화됩니다\./g)
      ?.length,
    1,
  );
  assert.match(view, /<span aria-hidden="true" className="text-lg leading-6 text-foreground">/);
  assert.match(view, /fetch\("\/api\/mm\/delete",/);
  assert.match(view, /credentials: "same-origin"/);
  assert.match(view, /variant="danger"/);
  assert.match(page, /getMemberAccountDeletionNavigation/);
  assert.match(page, /getSignedUserSession/);
  assert.match(page, /redirect\(`\/auth\/login\?returnTo=/);
  assert.match(page, /<MemberAccountDeletionView settingsHref=\{settingsHref\} \/>/);
  assert.match(story, /findByRole\("dialog", \{ name: "정말 탈퇴하시겠습니까\?" \}\)/);
});
