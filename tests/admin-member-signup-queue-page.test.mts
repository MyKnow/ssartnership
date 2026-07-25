import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("가입 승인 큐는 서버에서 페이지 단위로 읽고 목록 문맥을 보존한다", async () => {
  const [pageSource, repositorySource, viewSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/member-signup-requests/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/mm-signup-approval/repository.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminMemberSignupApprovalQueue.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /parseAdminReviewQueuePagination/);
  assert.match(pageSource, /listMattermostSignupApprovalRequestPage/);
  assert.match(pageSource, /redirect\(/);
  assert.doesNotMatch(pageSource, /throw new Error/);
  assert.match(repositorySource, /\.range\(/);
  assert.match(repositorySource, /count: "exact"/);
  assert.match(viewSource, /pagination/);
  assert.match(viewSource, /가입 승인 요청을 불러오지 못했습니다/);
  assert.match(viewSource, /pageSize/);
});
