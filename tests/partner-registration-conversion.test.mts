import assert from "node:assert/strict";
import test from "node:test";

import {
  createPartnerFromPortalRegistrationRequest,
  PartnerRegistrationConversionCleanupError,
  resolveRegistrationManagedCampusSlugs,
  rollbackPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestRow,
  type RegistrationCompanyInput,
  type RegistrationCompanyProvisioner,
  type RegistrationConversionSupabaseClient,
} from "../src/lib/partner-registration-conversion.server.ts";

type QueryError = { code?: string; message: string };
type QueryResponse = { data: unknown; error: QueryError | null; status: number };
type QueryOperation = "select" | "insert" | "update" | "delete" | "upsert";
type QueryCall = {
  table: string;
  operation: QueryOperation;
  values: unknown;
  filters: Array<[string, unknown]>;
};
type QueryHandler = (call: QueryCall) => Partial<QueryResponse> | undefined;

type QueryBuilder = PromiseLike<QueryResponse> & {
  select(columns?: string): QueryBuilder;
  insert(values: unknown): QueryBuilder;
  update(values: unknown): QueryBuilder;
  delete(): QueryBuilder;
  upsert(values: unknown, options?: unknown): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, value: unknown): QueryBuilder;
  order(column: string, options?: unknown): QueryBuilder;
  limit(count: number): QueryBuilder;
  single(): Promise<QueryResponse>;
  maybeSingle(): Promise<QueryResponse>;
};

function createSupabaseStub(handler: QueryHandler) {
  const calls: QueryCall[] = [];

  function from(table: string) {
    const call: QueryCall = {
      table,
      operation: "select",
      values: null,
      filters: [],
    };
    let mutation = false;
    const run = () => {
      calls.push(call);
      const result = handler(call) ?? {};
      return Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        status: result.status ?? (result.error ? 400 : call.operation === "insert" ? 201 : call.operation === "delete" ? 204 : 200),
      });
    };
    const builder: QueryBuilder = {
      select() {
        if (!mutation) {
          call.operation = "select";
        }
        return builder;
      },
      insert(values) {
        mutation = true;
        call.operation = "insert";
        call.values = values;
        return builder;
      },
      update(values) {
        mutation = true;
        call.operation = "update";
        call.values = values;
        return builder;
      },
      delete() {
        mutation = true;
        call.operation = "delete";
        return builder;
      },
      upsert(values) {
        mutation = true;
        call.operation = "upsert";
        call.values = values;
        return builder;
      },
      eq(column, value) {
        call.filters.push([column, value]);
        return builder;
      },
      in(column, value) {
        call.filters.push([column, value]);
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      single: run,
      maybeSingle: run,
      then(onFulfilled, onRejected) {
        return run().then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    client: { from } as unknown as RegistrationConversionSupabaseClient,
    calls,
  };
}

type FakeProvision = { company: { id: string } | null; label: string };

function createProvisioner(events: string[], options: { cleanupFails?: boolean } = {}) {
  const inputs: Array<{ input: RegistrationCompanyInput; managedCampusSlugs: string[] }> = [];
  const provisioner: RegistrationCompanyProvisioner<FakeProvision> = {
    async ensure(_supabase, input, ensureOptions) {
      events.push("provision:ensure");
      inputs.push({ input, managedCampusSlugs: ensureOptions.managedCampusSlugs });
      return { company: { id: "company-new" }, label: "fake" };
    },
    async cleanup(_supabase, provision) {
      events.push(`provision:cleanup:${provision?.company?.id ?? "none"}`);
      if (options.cleanupFails) {
        throw new Error("provision cleanup failed");
      }
    },
  };
  return { provisioner, inputs };
}

function createRequest(
  overrides: Partial<PartnerRegistrationRequestRow> = {},
): PartnerRegistrationRequestRow {
  return {
    id: "request-1",
    status: "pending",
    visibility: "public",
    admin_note: null,
    reviewed_by_admin_id: null,
    reviewed_at: null,
    source: "public_web",
    company_id: null,
    registration_mode: "full_new",
    service_mode: "offline",
    benefit_action_type: "certification",
    benefit_items: null,
    benefit_verification_pin_hash: "pin-hash",
    benefit_verification_pin_salt: "pin-salt",
    branch_scope_type: null,
    branch_scope_note: null,
    brand_name: "싸피 식당",
    category_id: "category-1",
    category_label: "식당",
    period_start: "2026-10-01",
    period_end: "2026-12-31",
    inquiry_link: null,
    detail_description: "설명",
    brand_phone: null,
    company_name: "싸피 컴퍼니",
    contact_name: "담당자",
    contact_email: "owner@example.com",
    contact_phone: null,
    company_description: null,
    benefits: ["10% 할인"],
    conditions: ["학생증 제시"],
    tags: ["점심"],
    location: "서울 강남구 테헤란로 212",
    map_url: null,
    site_link: null,
    benefit_action_link: null,
    thumbnail_url: null,
    image_urls: [],
    company: { managed_campus_slugs: ["seoul"] },
    ...overrides,
  };
}

test("전환 성공 시 회사·브랜드·제휴처·혜택을 순서대로 만들고 정리하지 않는다", async () => {
  const events: string[] = [];
  const insertedPartners: Array<Record<string, unknown>> = [];
  const { client, calls } = createSupabaseStub((call) => {
    events.push(`${call.table}:${call.operation}`);
    if (call.table === "partner_brand_profiles" && call.operation === "insert") {
      return { data: { ...(call.values as Record<string, unknown>), id: "brand-1" } };
    }
    if (call.table === "partners" && call.operation === "insert") {
      const row = call.values as Record<string, unknown>;
      insertedPartners.push(row);
      return {
        data: {
          id: row.id,
          name: row.name,
          location: row.location,
          campus_slugs: row.campus_slugs,
          visibility: row.visibility,
          benefits: row.benefits,
          conditions: row.conditions,
          period_start: row.period_start,
          period_end: row.period_end,
          map_url: row.map_url,
        },
      };
    }
    if (call.table === "partner_benefits" && call.operation === "insert") {
      return { data: call.values };
    }
    return { data: null };
  });
  const { provisioner, inputs } = createProvisioner(events);

  const result = await createPartnerFromPortalRegistrationRequest({
    supabase: client,
    request: createRequest({ visibility: "confidential" }),
    campusSlugs: ["seoul", "seoul"],
    companyProvisioner: provisioner,
  });

  assert.equal(result.created, true);
  assert.equal(result.partners.length, 1);
  assert.deepEqual(inputs, [
    {
      input: {
        companyId: null,
        name: "싸피 컴퍼니",
        description: null,
        contactName: "담당자",
        contactEmail: "owner@example.com",
        contactPhone: null,
      },
      managedCampusSlugs: ["seoul"],
    },
  ]);
  assert.deepEqual(events, [
    "provision:ensure",
    "partner_brand_profiles:select",
    "partner_brand_profiles:insert",
    "partner_registration_benefit_groups:select",
    "partner_registration_branches:select",
    "partners:select",
    "partners:insert",
    "partner_benefits:insert",
  ]);

  const [row] = insertedPartners;
  assert.equal(row?.company_id, "company-new");
  assert.equal(row?.brand_profile_id, "brand-1");
  assert.equal(row?.name, "싸피 식당");
  assert.equal(row?.location, "서울 강남구 테헤란로 212");
  assert.deepEqual(row?.campus_slugs, ["seoul"]);
  assert.deepEqual(row?.managed_campus_slugs, ["seoul"]);
  assert.equal(row?.visibility, "confidential");
  assert.equal(row?.benefit_visibility, "public");
  assert.equal(row?.reservation_link, null);
  assert.equal(row?.branch_scope_type, "single_location");
  assert.deepEqual(row?.applies_to, ["staff", "student", "graduate"]);
  assert.equal(row?.benefit_verification_pin_hash, "pin-hash");
  assert.equal(row?.benefit_verification_pin_salt, "pin-salt");
  assert.ok(
    !calls.some((call) => call.operation === "delete"),
    "성공 경로에서는 정리 쿼리를 실행하지 않는다",
  );
});

test("이미 연결된 회사 신청은 회사 프로비저닝 없이 기존 회사로 전환한다", async () => {
  const events: string[] = [];
  const { client } = createSupabaseStub((call) => {
    if (call.table === "partner_brand_profiles" && call.operation === "select") {
      return { data: { id: "brand-existing" } };
    }
    if (call.table === "partners" && call.operation === "select") {
      return {
        data: { id: "partner-existing", name: "싸피 식당", location: "서울" },
      };
    }
    return { data: null };
  });
  const { provisioner } = createProvisioner(events);

  const result = await createPartnerFromPortalRegistrationRequest({
    supabase: client,
    request: createRequest({ company_id: "company-1" }),
    campusSlugs: ["seoul"],
    companyProvisioner: provisioner,
  });

  assert.deepEqual(events, []);
  assert.deepEqual(
    result.partners.map((partner) => partner.id),
    ["partner-existing"],
  );
});

test("카테고리나 노출 캠퍼스가 없으면 아무것도 만들지 않는다", async () => {
  const events: string[] = [];
  const { client, calls } = createSupabaseStub(() => ({ data: null }));
  const { provisioner } = createProvisioner(events);

  assert.deepEqual(
    await createPartnerFromPortalRegistrationRequest({
      supabase: client,
      request: createRequest({ category_id: null }),
      campusSlugs: ["seoul"],
      companyProvisioner: provisioner,
    }),
    { partners: [], created: false },
  );
  assert.deepEqual(
    await createPartnerFromPortalRegistrationRequest({
      supabase: client,
      request: createRequest(),
      campusSlugs: [],
      companyProvisioner: provisioner,
    }),
    { partners: [], created: false },
  );
  assert.equal(calls.length, 0);
  assert.deepEqual(events, []);
});

test("두 번째 혜택 그룹 저장이 실패하면 이번 시도에서 만든 행만 역순으로 정리한다", async () => {
  const events: string[] = [];
  let partnerInsertCount = 0;
  const deleteFilters: Array<[string, unknown]> = [];
  const { client } = createSupabaseStub((call) => {
    events.push(`${call.table}:${call.operation}`);
    if (call.table === "partner_brand_profiles" && call.operation === "insert") {
      return { data: { ...(call.values as Record<string, unknown>), id: "brand-1" } };
    }
    if (call.table === "partner_registration_benefit_groups") {
      return {
        data: [
          { group_key: "G01", label: "기본", benefits: ["10% 할인"] },
          { group_key: "G02", label: "주말", benefits: ["음료 제공"] },
        ],
      };
    }
    if (call.table === "partners" && call.operation === "insert") {
      partnerInsertCount += 1;
      if (partnerInsertCount === 2) {
        return { error: { code: "23502", message: "partner insert failed" } };
      }
      const row = call.values as Record<string, unknown>;
      return { data: { id: row.id, name: row.name, location: row.location } };
    }
    if (call.operation === "delete") {
      deleteFilters.push(...call.filters);
      const ids = call.filters.find(([column]) => column === "id")?.[1];
      return { data: (Array.isArray(ids) ? ids : [ids]).map((id) => ({ id })), status: 200 };
    }
    if (call.table === "partner_benefits" && call.operation === "insert") {
      return { data: call.values };
    }
    return { data: null };
  });
  const { provisioner } = createProvisioner(events);

  await assert.rejects(
    createPartnerFromPortalRegistrationRequest({
      supabase: client,
      request: createRequest(),
      campusSlugs: ["seoul"],
      companyProvisioner: provisioner,
    }),
    /partner insert failed/,
  );

  const cleanupEvents = events.slice(events.lastIndexOf("partners:insert") + 1);
  assert.deepEqual(cleanupEvents, [
    "partners:delete",
    "partner_brand_profiles:delete",
    "provision:cleanup:company-new",
  ]);
  const [partnerFilter, brandFilter] = deleteFilters;
  assert.equal(partnerFilter?.[0], "id");
  assert.equal((partnerFilter?.[1] as string[]).length, 1);
  assert.deepEqual(brandFilter, ["id", "brand-1"]);
});

test("정리 쿼리가 실패하면 나머지 정리를 계속하고 정리 실패로 전파한다", async () => {
  const events: string[] = [];
  const { client } = createSupabaseStub((call) => {
    events.push(`${call.table}:${call.operation}`);
    if (call.table === "partner_brand_profiles" && call.operation === "insert") {
      return { data: { ...(call.values as Record<string, unknown>), id: "brand-1" } };
    }
    if (call.table === "partners" && call.operation === "insert") {
      const row = call.values as Record<string, unknown>;
      return { data: { id: row.id, name: row.name, location: row.location } };
    }
    if (call.table === "partner_benefits") {
      return { error: { message: "benefit insert failed" } };
    }
    if (call.table === "partners" && call.operation === "delete") {
      return { error: { code: "XX001", message: "partner delete failed" } };
    }
    if (call.table === "partner_brand_profiles" && call.operation === "delete") {
      return { data: [{ id: "brand-1" }], status: 200 };
    }
    return { data: null };
  });
  const { provisioner } = createProvisioner(events, { cleanupFails: true });
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    await assert.rejects(
      createPartnerFromPortalRegistrationRequest({
        supabase: client,
        request: createRequest(),
        campusSlugs: ["seoul"],
        companyProvisioner: provisioner,
      }),
      (error: unknown) => {
        assert.ok(error instanceof PartnerRegistrationConversionCleanupError);
        assert.equal(error.message, "partner_registration_conversion_cleanup_failed");
        const cause = error.cause as { originalError: Error; cleanupError: Error };
        assert.equal(cause.originalError.message, "benefit insert failed");
        assert.equal(
          cause.cleanupError.message,
          "partner_registration_conversion_cleanup_failed",
        );
        return true;
      },
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(events.slice(-3), [
    "partners:delete",
    "partner_brand_profiles:delete",
    "provision:cleanup:company-new",
  ]);
});

test("관리 캠퍼스는 회사 범위를 우선하고 없으면 위치에서 추론한다", () => {
  assert.deepEqual(
    resolveRegistrationManagedCampusSlugs({
      company: [{ managed_campus_slugs: ["gumi"] }],
      location: "서울 강남구",
    }),
    ["gumi"],
  );
  assert.deepEqual(
    resolveRegistrationManagedCampusSlugs({
      company: null,
      location: "서울 강남구 테헤란로 212",
    }),
    ["seoul"],
  );
});

test("신청 상태 복원은 이번 시도가 쓴 상태일 때만 이전 값으로 되돌린다", async () => {
  const updates: QueryCall[] = [];
  let restored = true;
  const { client } = createSupabaseStub((call) => {
    updates.push(call);
    return { data: restored ? { id: "request-1" } : null };
  });

  assert.equal(
    await rollbackPartnerRegistrationRequestStatus({
      supabase: client,
      request: createRequest({ status: "in_review", visibility: "unknown" }),
      requestedStatus: "converted",
    }),
    true,
  );
  assert.deepEqual(updates[0]?.filters, [
    ["id", "request-1"],
    ["status", "converted"],
  ]);
  assert.deepEqual(updates[0]?.values, {
    status: "in_review",
    visibility: "public",
    admin_note: null,
    reviewed_by_admin_id: null,
    reviewed_at: null,
  });

  restored = false;
  assert.equal(
    await rollbackPartnerRegistrationRequestStatus({
      supabase: client,
      request: createRequest(),
      requestedStatus: "converted",
    }),
    false,
  );
});
