import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("수료생 인증의 두 운영 큐는 독립적인 서버 페이지네이션과 안전한 복구를 제공한다", async () => {
  const [pageSource, viewSource, readModelSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/graduate-verifications/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminGraduateVerificationQueue.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/lib/admin-graduate-verification-queue.server.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /parseAdminReviewQueuePagination/);
  assert.match(pageSource, /requestPage/);
  assert.match(pageSource, /setupEmailRetryPage/);
  assert.match(pageSource, /getAdminGraduateVerificationRequestQueueReadModel/);
  assert.match(pageSource, /getAdminGraduateSetupEmailRetryQueueReadModel/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.match(readModelSource, /\.range\(/);
  assert.match(readModelSource, /count: "exact"/);
  assert.match(readModelSource, /queueLoadError: true/);
  assert.match(pageSource, /redirect\(/);
  assert.doesNotMatch(pageSource, /throw new Error/);
  assert.match(viewSource, /QueuePagination/);
  assert.match(viewSource, /수료생 인증 요청을 불러오지 못했습니다/);
  assert.match(viewSource, /setupEmailRetryPagination/);
  assert.match(viewSource, /AdminGraduateVerificationRetryLoading/);
  assert.match(viewSource, /aria-busy="true"/);
});
