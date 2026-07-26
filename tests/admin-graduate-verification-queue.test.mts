import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/admin/(protected)/graduate-verifications/page.tsx", import.meta.url);
const queuePath = new URL("../src/components/admin/AdminGraduateVerificationQueue.tsx", import.meta.url);
const readModelPath = new URL(
  "../src/lib/admin-graduate-verification-queue.server.ts",
  import.meta.url,
);
const mediaViewerPath = new URL(
  "../src/components/admin/AdminGraduateVerificationMediaViewer.tsx",
  import.meta.url,
);

test("수료생 검토 페이지는 사진 변경 대기열을 전용 관리자 화면으로 분리한다", async () => {
  const [pageSource, readModelSource] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(readModelPath, "utf8"),
  ]);

  assert.doesNotMatch(pageSource, /member_profile_images/);
  assert.doesNotMatch(pageSource, /approveGraduateProfileImageAction/);
  assert.match(pageSource, /getAdminGraduateVerificationQueueReadModel/);
  assert.match(readModelSource, /graduate_verification_requests/);
});

test("관리자 미디어 액션은 새 탭 링크 대신 이미지 뷰어를 연다", async () => {
  const [queueSource, viewerSource] = await Promise.all([
    readFile(queuePath, "utf8"),
    readFile(mediaViewerPath, "utf8"),
  ]);

  assert.doesNotMatch(queueSource, /from ["']next\/link["']/);
  assert.match(queueSource, /AdminGraduateVerificationMediaViewer/);
  assert.match(viewerSource, /<button\b/);
  assert.match(viewerSource, /pdfjs-dist/);
  assert.match(viewerSource, /getDocument/);
  assert.match(viewerSource, /credentials:\s*["']same-origin["']/);
});

test("수료생 검토의 결정 입력은 레이블·도움말·공용 폼 제어를 제공한다", async () => {
  const queueSource = await readFile(queuePath, "utf8");

  assert.match(queueSource, /from "@\/components\/ui\/Input"/);
  assert.match(queueSource, /from "@\/components\/ui\/Textarea"/);
  assert.match(queueSource, /<fieldset/);
  assert.match(queueSource, /<legend/);
  assert.match(queueSource, /htmlFor=\{documentNumberInputId\}/);
  assert.match(queueSource, /수료증에 적힌 문서 번호를 입력하세요/);
  assert.match(queueSource, /htmlFor=\{existingMemberIdInputId\}/);
  assert.match(queueSource, /회원 상세에서 복사한 UUID를 입력하세요/);
  assert.match(queueSource, /보완이 필요한 항목/);
  assert.match(queueSource, /보완 요청 사유/);
  assert.match(queueSource, /반려 사유/);
  assert.match(queueSource, /min-h-11 cursor-pointer/);
  assert.doesNotMatch(
    queueSource,
    /className="h-11 min-w-56 rounded-\[1rem\] border border-border bg-surface px-3 text-sm"/,
  );
});
