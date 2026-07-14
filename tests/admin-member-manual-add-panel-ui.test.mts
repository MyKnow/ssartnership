import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("수동 회원 행은 기수·캠퍼스 선택과 사진 파일 선택을 제공한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminMemberManualAddPanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getManualMemberImportGenerationOptions/);
  assert.match(source, /MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS/);
  assert.match(source, /MANUAL_MEMBER_IMPORT_PHOTO_ACCEPT/);
  assert.match(source, /getManualMemberImportRowReadiness/);
  assert.match(source, /canCreateMembers/);
  assert.match(source, /getManualMemberImportErrorFocusField/);
  assert.match(source, /data-member-import-field="generation"/);
  assert.match(source, /data-member-import-field="campus"/);
  assert.match(source, /행 사진 선택/);
  assert.match(source, /사진 연결 해제/);
  assert.match(source, /사진 \(선택 사항\)/);
  assert.match(source, /MM ID 또는 이메일 중 하나는 필수입니다/);
  assert.match(source, /MM 조회 미지원 기수에서는/);
  assert.match(source, /MM ID 대신 이메일만 입력해 주세요/);
  assert.match(source, /const canRetryFailedMembers = \(result\?\.retryableFailures \?\? 0\) > 0;/);
  assert.match(source, /\(!result \|\| canRetryFailedMembers\)/);
  assert.match(source, /if \(!batch \|\| !rowReadiness\.isComplete \|\| pending \|\| \(result && result\.retryableFailures === 0\)\) return;/);
  assert.match(source, /실패 행 재시도/);
  assert.match(source, /전송 결과 확인이 필요한 행이 있어 자동 재시도는 중지되었습니다/);
  assert.doesNotMatch(source, /사진 파일명/);
});
