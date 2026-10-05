import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OWN_PHONE_INPUT_ATTRIBUTES,
  PHONE_INPUT_ATTRIBUTES,
  SEARCH_INPUT_ATTRIBUTES,
} from "../src/components/ui/input-attributes.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("전화번호 입력은 tel 키패드를 쓰고 본인 번호일 때만 자동완성을 허용한다", () => {
  assert.deepEqual(PHONE_INPUT_ATTRIBUTES, {
    type: "tel",
    inputMode: "tel",
    autoComplete: "off",
  });
  assert.deepEqual(OWN_PHONE_INPUT_ATTRIBUTES, {
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel",
  });
  assert.deepEqual(SEARCH_INPUT_ATTRIBUTES, { type: "search", enterKeyHint: "search" });
});

test("전화번호 필드는 공용 tel 속성을 쓴다", () => {
  for (const [path, constant, field] of [
    [
      "src/components/partner-registration/PartnerRegistrationContactStep.tsx",
      "OWN_PHONE_INPUT_ATTRIBUTES",
      'name="contactPhone"',
    ],
    [
      "src/components/partner-registration/PartnerRegistrationClient.tsx",
      "PHONE_INPUT_ATTRIBUTES",
      'name="brandPhone"',
    ],
    [
      "src/components/partner-card-form/PartnerCompanySection.tsx",
      "PHONE_INPUT_ATTRIBUTES",
      'name="companyContactPhone"',
    ],
    [
      "src/components/admin/AdminPartnerRegistrationsView.tsx",
      "PHONE_INPUT_ATTRIBUTES",
      'name="brandPhone"',
    ],
    [
      "src/components/admin/AdminPartnerRegistrationsView.tsx",
      "PHONE_INPUT_ATTRIBUTES",
      'name="contactPhone"',
    ],
    [
      "src/components/partner-branches/PartnerBranchListEditor.tsx",
      "PHONE_INPUT_ATTRIBUTES",
      "id={`${row.id}-phone`}",
    ],
  ] as const) {
    const source = read(path);
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      source,
      new RegExp(`\\{\\.\\.\\.${constant}\\}\\s+${escapedField}`),
      `${path}: ${field}에 ${constant}`,
    );
  }
});

test("검색 입력은 모바일 엔터 키를 검색으로 표시한다", () => {
  for (const path of [
    "src/app/(site)/events/project-showcase/page.tsx",
    "src/components/admin/AdminGlobalSearchResultsView.tsx",
    "src/components/partner/partner-notifications/PartnerNotificationCenter.tsx",
  ]) {
    assert.match(read(path), /\{\.\.\.SEARCH_INPUT_ATTRIBUTES\}/, path);
  }
  // Enter로 검색을 적용하는 관리자 필터 입력(type 변경 없이 엔터 라벨만 지정)
  for (const [path, label] of [
    ["src/components/admin/AdminPartnerManager.tsx", "제휴처명 검색"],
    ["src/components/admin/AdminMemberManager.tsx", "회원 검색"],
  ] as const) {
    assert.match(
      read(path),
      new RegExp(`aria-label="${label}"\\s+enterKeyHint="search"`),
      path,
    );
  }
  assert.match(read("src/components/PartnerFilters.tsx"), /enterKeyHint=\{isHomeDirectory \? "search" : undefined\}/);
  assert.match(read("src/components/admin/AdminQuickNavigator.tsx"), /enterKeyHint="go"/);
});
