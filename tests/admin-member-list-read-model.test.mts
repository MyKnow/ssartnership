import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseAdminMemberListFilters,
  parseAdminMemberPage,
} from "../src/lib/admin-member-list.server.ts";

const memberPagePath = new URL(
  "../src/app/admin/(protected)/members/page.tsx",
  import.meta.url,
);
const memberReadModelPath = new URL(
  "../src/lib/admin-member-list.server.ts",
  import.meta.url,
);

test("관리자 회원 목록은 페이지에서 DB 조회를 분리하고 서버 read-model로 페이지네이션한다", async () => {
  const [pageSource, readModelSource] = await Promise.all([
    readFile(memberPagePath, "utf8"),
    readFile(memberReadModelPath, "utf8"),
  ]);

  assert.match(pageSource, /getAdminMemberListReadModel/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.match(readModelSource, /\{ count: "exact" \},/);
  assert.match(readModelSource, /memberQuery = memberQuery\.range\(/);
  assert.match(readModelSource, /from \+ pageSize - 1/);
  assert.match(readModelSource, /shouldRedirectToLastPage: page > totalPages/);
  assert.match(readModelSource, /escapeLikePattern\(searchValue\)/);
  assert.match(readModelSource, /is\("deleted_at", null\)/);
  assert.match(pageSource, /redirect\(`\/admin\/members\?/);
});

test("회원 목록 read-model은 오류를 안전한 상태로 돌려준다", async () => {
  const source = await readFile(memberReadModelPath, "utf8");

  assert.match(source, /hasMemberLoadError/);
  assert.doesNotMatch(source, /Error\.message/);
});

test("회원 목록 URL 필터는 알려진 값만 수용하고 검색 입력을 제한한다", () => {
  const filters = parseAdminMemberListFilters({
    q: `  ${"가".repeat(120)}  `,
    sort: "name",
    status: "mustChangePassword",
    mmLifecycle: "graduated",
    year: "15",
    campus: "서울",
    serviceConsent: "agreed",
    pushEnabled: "disabled",
    marketingEnabled: "enabled",
  });

  assert.equal(filters.searchValue, "가".repeat(100));
  assert.equal(filters.sortValue, "name");
  assert.equal(filters.filterValue, "mustChangePassword");
  assert.equal(filters.mattermostLifecycleFilter, "graduated");
  assert.equal(filters.yearFilter, "15");
  assert.equal(filters.campusFilter, "서울");
  assert.equal(filters.serviceConsentFilter, "agreed");
  assert.equal(filters.pushEnabledFilter, "disabled");
  assert.equal(filters.marketingEnabledFilter, "enabled");
  assert.equal(parseAdminMemberPage("999999"), 10_000);
  assert.equal(parseAdminMemberPage("not-a-page"), 1);
});
