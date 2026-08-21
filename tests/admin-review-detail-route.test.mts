import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("리뷰 상세 API는 목록과 동일한 권한·지역 범위를 적용하고 안전한 응답을 사용한다", async () => {
  const [route, repository] = await Promise.all([
    readFile(
      new URL(
        "../src/app/api/admin/reviews/[reviewId]/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/lib/admin-reviews.ts", import.meta.url), "utf8"),
  ]);

  assert.match(
    route,
    /ensureAdminApiPermission\(request, "reviews", "read"\)/,
  );
  assert.match(route, /getManagedCampusFilterValues\(session\.account\)/);
  assert.match(route, /getAdminReviewById\(/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /error\.message/);
  assert.match(repository, /export type AdminReviewSummary/);
  assert.match(repository, /toAdminReviewSummary/);
  assert.match(repository, /managed_campus_slugs/);
});
