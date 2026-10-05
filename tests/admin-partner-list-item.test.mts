import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeAdminPartnerListCompany,
  toAdminPartnerListItem,
} from "../src/lib/admin-partner-list-item.ts";

const root = new URL("..", import.meta.url);

test("관리자 제휴처 목록 행은 camelCase 도메인 모델로 매핑된다", () => {
  const item = toAdminPartnerListItem({
    id: "partner-1",
    name: "역삼 분식랩",
    category_id: "cat-food",
    company_id: "company-1",
    location: "서울 강남구 역삼동 123-4",
    managed_campus_slugs: ["seoul"],
    map_url: "https://map.example.com/1",
    period_start: "2026-04-01",
    period_end: "2026-12-31",
    applies_to: ["student", "staff"],
    visibility: " Confidential ",
    company: [{ id: "company-1", name: "분식랩", slug: "bunsik-lab" }],
  });

  assert.deepEqual(item, {
    id: "partner-1",
    name: "역삼 분식랩",
    categoryId: "cat-food",
    companyId: "company-1",
    location: "서울 강남구 역삼동 123-4",
    managedCampusSlugs: ["seoul"],
    mapUrl: "https://map.example.com/1",
    periodStart: "2026-04-01",
    periodEnd: "2026-12-31",
    appliesTo: ["student", "staff"],
    visibility: "confidential",
    company: { id: "company-1", name: "분식랩", slug: "bunsik-lab" },
  });
});

test("비어 있는 컬럼은 목록 UI가 기대하던 기본값으로 정규화된다", () => {
  const item = toAdminPartnerListItem({
    id: "partner-2",
    name: "미분류 제휴처",
    category_id: null,
    company_id: null,
    location: null,
    visibility: "unknown",
    company: null,
  });

  assert.deepEqual(item, {
    id: "partner-2",
    name: "미분류 제휴처",
    categoryId: "",
    companyId: null,
    location: "",
    managedCampusSlugs: [],
    mapUrl: null,
    periodStart: null,
    periodEnd: null,
    appliesTo: [],
    visibility: "public",
    company: null,
  });
});

test("파트너사 embed는 객체·배열·빈 값을 모두 처리하고 선택 컬럼만 남긴다", () => {
  assert.deepEqual(
    normalizeAdminPartnerListCompany({
      id: "company-1",
      name: "분식랩",
      slug: "bunsik-lab",
      description: "목록에 필요 없는 컬럼",
    }),
    { id: "company-1", name: "분식랩", slug: "bunsik-lab" },
  );
  assert.deepEqual(
    normalizeAdminPartnerListCompany([{ id: "company-2", name: "헤어", slug: "hair" }]),
    { id: "company-2", name: "헤어", slug: "hair" },
  );
  assert.equal(normalizeAdminPartnerListCompany([]), null);
  assert.equal(normalizeAdminPartnerListCompany(null), null);
  assert.equal(normalizeAdminPartnerListCompany("company-1"), null);
});

test("읽기 모델은 매퍼를 쓰고 목록 UI는 DB 컬럼명에 의존하지 않는다", async () => {
  const [readModel, ...uiSources] = await Promise.all([
    readFile(new URL("src/lib/admin-partner-list.server.ts", root), "utf8"),
    readFile(new URL("src/components/admin/partner-manager/types.ts", root), "utf8"),
    readFile(new URL("src/components/admin/partner-manager/selectors.ts", root), "utf8"),
    readFile(
      new URL("src/components/admin/partner-manager/AdminPartnerListItem.tsx", root),
      "utf8",
    ),
    readFile(
      new URL("src/components/admin/partner-manager/AdminPartnerManagerList.tsx", root),
      "utf8",
    ),
  ]);

  assert.match(readModel, /partnerRows\.map\(toAdminPartnerListItem\)/);
  assert.doesNotMatch(readModel, /\.\.\.partner,/);
  for (const source of uiSources) {
    assert.doesNotMatch(
      source,
      /\b(category_id|company_id|map_url|period_start|period_end|applies_to|benefit_action_link|reservation_link|inquiry_link)\b/,
    );
  }
});
