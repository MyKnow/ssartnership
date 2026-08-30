import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ADMIN_SEARCH_QUERY_MAX_LENGTH,
  escapeAdminSearchLikePattern,
  getAdminSearchLikePattern,
  normalizeAdminSearchQuery,
} from "../src/lib/admin-search-query.ts";

test("관리자 검색어는 화면과 무관하게 같은 공백 및 길이 규칙을 사용한다", () => {
  assert.equal(ADMIN_SEARCH_QUERY_MAX_LENGTH, 80);
  assert.equal(normalizeAdminSearchQuery("  김\n  싸피\t "), "김 싸피");
  assert.equal(normalizeAdminSearchQuery("x".repeat(100)), "x".repeat(80));
  assert.equal(normalizeAdminSearchQuery(null), "");
  assert.equal(normalizeAdminSearchQuery("abcdef", 3), "abc");
  assert.equal(normalizeAdminSearchQuery("abcdef", 0), "abcdef");
});

test("관리자 부분 검색은 PostgREST wildcard를 한 경계에서 escape한다", () => {
  assert.equal(escapeAdminSearchLikePattern(String.raw`50%_off\sale`), String.raw`50\%\_off\\sale`);
  assert.equal(getAdminSearchLikePattern(String.raw`50%_off\sale`), String.raw`%50\%\_off\\sale%`);
});

test("관리자 목록과 통합·푸시·리뷰 검색은 공용 검색 계약을 재사용한다", async () => {
  const paths = [
    "admin-global-search.ts",
    "admin-push-recipient-search.server.ts",
    "admin-member-list.server.ts",
    "admin-reviews.ts",
    "admin-partner-list.server.ts",
  ];
  const sources = await Promise.all(paths.map((path) =>
    readFile(new URL(`../src/lib/${path}`, import.meta.url), "utf8")));

  for (const source of sources) {
    assert.match(source, /@\/lib\/admin-search-query/u);
    assert.doesNotMatch(source, /function (?:escapeLikePattern|getSafeSearchPattern|getPartnerNameSearchPattern)\b/u);
  }
});
