import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const certificationPageUrl = new URL(
  "../src/app/(site)/certification/page.tsx",
  import.meta.url,
);
const settingsPageUrl = new URL(
  "../src/app/(site)/settings/page.tsx",
  import.meta.url,
);
const memberSettingsViewUrl = new URL(
  "../src/components/settings/MemberSettingsView.tsx",
  import.meta.url,
);
const accountSettingsUrl = new URL(
  "../src/components/certification/CertificationAccountSettings.tsx",
  import.meta.url,
);
const settingsListUrl = new URL(
  "../src/components/certification/CertificationSettingsList.tsx",
  import.meta.url,
);
const footerActionsUrl = new URL(
  "../src/components/certification/CertificationFooterActions.tsx",
  import.meta.url,
);
const emailSummaryUrl = new URL(
  "../src/components/certification/CertificationEmailSummary.tsx",
  import.meta.url,
);
const mattermostSyncActionUrl = new URL(
  "../src/components/certification/CertificationMattermostSyncAction.tsx",
  import.meta.url,
);

test("계정 항목은 내 인증에서 분리된 설정 화면의 그룹형 리스트로 표시된다", async () => {
  const [
    certificationPage,
    settingsPage,
    memberSettingsView,
    settings,
    footerActions,
    emailSummary,
    mattermostSyncAction,
  ] = await Promise.all([
    readFile(certificationPageUrl, "utf8"),
    readFile(settingsPageUrl, "utf8"),
    readFile(memberSettingsViewUrl, "utf8"),
    readFile(accountSettingsUrl, "utf8"),
    readFile(footerActionsUrl, "utf8"),
    readFile(emailSummaryUrl, "utf8"),
    readFile(mattermostSyncActionUrl, "utf8"),
  ]);

  assert.doesNotMatch(certificationPage, /CertificationAccountSettings/);
  assert.match(settingsPage, /<MemberSettingsView/);
  assert.match(memberSettingsView, /<CertificationAccountSettings/);
  assert.match(memberSettingsView, /title="설정"/);
  assert.doesNotMatch(memberSettingsView, /eyebrow=/);
  assert.match(memberSettingsView, /className="border-b-0"/);
  assert.doesNotMatch(
    memberSettingsView,
    /계정 연결 정보와 로그인 보안을 한곳에서 관리합니다\./,
  );
  assert.doesNotMatch(settingsPage, /<CertificationMattermostSyncAction/);
  assert.doesNotMatch(settingsPage, /<CertificationEmailSummary/);
  assert.match(settings, /aria-label="계정 설정"/);
  assert.match(settings, /연결 정보/);
  assert.match(footerActions, /title="보안"/);
  assert.match(footerActions, /title="계정"/);
  assert.match(footerActions, /tone="danger"/);
  assert.match(
    emailSummary,
    /MM 사용이 어려울 때를 대비해 이메일을 등록할 수 있습니다\./,
  );
  assert.doesNotMatch(emailSummary, /trailingLabel=/);
  assert.match(mattermostSyncAction, /title="Mattermost 프로필 동기화"/);
  assert.doesNotMatch(mattermostSyncAction, /trailingLabel=/);
  assert.match(
    footerActions,
    /인증 카드에 표시할 본인 사진을 변경합니다\./,
  );
  assert.match(footerActions, /이 기기에서 로그아웃합니다\./);
  assert.match(footerActions, /혜택 이용을 포기하고 탈퇴합니다\./);
  assert.doesNotMatch(footerActions, /trailingLabel=/);
});

test("설정 행은 전체 행 조작, 상태 표시, 이동·로딩 피드백을 제공한다", async () => {
  const source = await readFile(settingsListUrl, "utf8");

  assert.match(source, /divide-y divide-border\/70/);
  assert.match(source, /min-h-\[4\.75rem\]/);
  assert.match(source, /min-w-0 flex-1/);
  assert.match(source, /break-words/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(source, /ChevronRightIcon/);
  assert.match(source, /Spinner/);
});
