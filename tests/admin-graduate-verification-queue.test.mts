import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/admin/(protected)/graduate-verifications/page.tsx", import.meta.url);
const queuePath = new URL("../src/components/admin/AdminGraduateVerificationQueue.tsx", import.meta.url);
const mediaViewerPath = new URL(
  "../src/components/admin/AdminGraduateVerificationMediaViewer.tsx",
  import.meta.url,
);

test("수료생 검토 페이지는 사진 변경 대기열을 전용 관리자 화면으로 분리한다", async () => {
  const pageSource = await readFile(pagePath, "utf8");

  assert.doesNotMatch(pageSource, /member_profile_images/);
  assert.doesNotMatch(pageSource, /approveGraduateProfileImageAction/);
  assert.match(pageSource, /graduate_verification_requests/);
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
