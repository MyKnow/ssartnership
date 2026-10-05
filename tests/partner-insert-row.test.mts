import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PARTNER_INSERT_COLUMNS,
  buildPartnerInsertRow,
  type PartnerInsertRowInput,
} from "../src/lib/partner-admin/partner-insert-row.ts";
import {
  createPartnerFromPortalRegistrationRequest,
  type RegistrationCompanyProvisioner,
  type RegistrationConversionSupabaseClient,
} from "../src/lib/partner-registration-conversion.server.ts";

const root = new URL("..", import.meta.url);

const baseInput: PartnerInsertRowInput = {
  id: "partner-1",
  companyId: "company-1",
  brandProfileId: "brand-1",
  name: "싸피 식당",
  categoryId: "category-1",
  location: "서울 강남구",
  detailDescription: null,
  campusSlugs: ["seoul"],
  managedCampusSlugs: ["seoul"],
  mapUrl: null,
  benefitActionType: "certification",
  benefitActionLink: null,
  benefitVerificationPinHash: null,
  benefitVerificationPinSalt: null,
  reservationLink: null,
  inquiryLink: null,
  periodStart: null,
  periodEnd: null,
  conditions: [],
  benefits: ["10% 할인"],
  appliesTo: ["student"],
  thumbnail: null,
  images: [],
  tags: [],
  visibility: "public",
  benefitVisibility: "public",
  branchScopeType: "single_location",
  branchScopeNote: null,
};

test("제휴처 insert 행 빌더는 계약된 컬럼만 정확히 만든다", () => {
  const row = buildPartnerInsertRow(baseInput);

  assert.deepEqual(Object.keys(row), [...PARTNER_INSERT_COLUMNS]);
  assert.equal(row.company_id, "company-1");
  assert.equal(row.brand_profile_id, "brand-1");
  assert.deepEqual(row.managed_campus_slugs, ["seoul"]);
  assert.equal(row.branch_scope_type, "single_location");
});

test("등록 신청 전환 경로는 같은 빌더 컬럼 집합으로 제휴처를 만든다", async () => {
  const insertedRows: Array<Record<string, unknown>> = [];
  const from = (table: string) => {
    let operation = "select";
    let values: unknown = null;
    const respond = () => {
      if (table === "partner_brand_profiles" && operation === "insert") {
        const row = values as { company_id: string; name: string };
        return Promise.resolve({
          data: { id: "brand-1", company_id: row.company_id, name: row.name },
          error: null,
          status: 201,
        });
      }
      if (table === "partners" && operation === "insert") {
        insertedRows.push(values as Record<string, unknown>);
        const row = values as { id: string; name: string; location: string };
        return Promise.resolve({
          data: { id: row.id, name: row.name, location: row.location },
          error: null,
          status: 201,
        });
      }
      return Promise.resolve({ data: null, error: null, status: 200 });
    };
    const builder = {
      select: () => builder,
      insert: (nextValues: unknown) => {
        operation = "insert";
        values = nextValues;
        return builder;
      },
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      single: respond,
      maybeSingle: respond,
      then: (
        onFulfilled: (value: { data: unknown; error: null; status: number }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => respond().then(onFulfilled, onRejected),
    };
    return builder;
  };
  const provisioner: RegistrationCompanyProvisioner<{
    company: { id: string } | null;
  }> = {
    ensure: async () => ({ company: { id: "company-1" } }),
    cleanup: async () => undefined,
  };

  await createPartnerFromPortalRegistrationRequest({
    supabase: { from } as unknown as RegistrationConversionSupabaseClient,
    request: {
      id: "request-1",
      status: "pending",
      service_mode: "online",
      benefit_action_type: "external_link",
      brand_name: "싸피 온라인",
      category_id: "category-1",
      category_label: "온라인",
      company_name: "싸피 컴퍼니",
      contact_name: "담당자",
      contact_email: "owner@example.com",
      location: "온라인",
      site_link: "https://example.com",
    },
    campusSlugs: ["seoul"],
    companyProvisioner: provisioner,
  });

  assert.equal(insertedRows.length, 1);
  assert.deepEqual(
    Object.keys(insertedRows[0] ?? {}).sort(),
    [...PARTNER_INSERT_COLUMNS].sort(),
  );
  assert.equal(insertedRows[0]?.branch_scope_type, "online");
  assert.equal(insertedRows[0]?.benefit_action_link, "https://example.com");
});

test("관리자 생성과 등록 신청 전환은 제휴처 insert 컬럼을 직접 나열하지 않는다", async () => {
  const [createSource, conversionSource] = await Promise.all([
    readFile(
      new URL("src/app/admin/(protected)/_actions/partner-actions/create.ts", root),
      "utf8",
    ),
    readFile(new URL("src/lib/partner-registration-conversion.server.ts", root), "utf8"),
  ]);

  for (const source of [createSource, conversionSource]) {
    assert.match(source, /buildPartnerInsertRow\(\{/);
    assert.doesNotMatch(source, /from\("partners"\)\s*\.insert\(\{/);
    assert.doesNotMatch(source, /managed_campus_slugs:/);
  }
});
