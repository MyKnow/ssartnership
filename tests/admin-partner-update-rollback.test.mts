import assert from "node:assert/strict";
import test from "node:test";

import {
  rollbackPartnerUpdateMutation,
  type PartnerUpdateRollbackSnapshot,
} from "../src/app/admin/(protected)/_actions/partner-support/update-rollback.ts";

type QueryResult = {
  error: { message: string } | null;
};

class FakeTableOperation {
  private readonly filters = new Map<string, string>();
  private readonly table: string;
  private readonly type: "update" | "delete" | "insert";
  private readonly payload: unknown;
  private readonly state: {
    calls: Array<{ table: string; type: string; payload: unknown; filters: Record<string, string> }>;
  };
  private readonly failures: Partial<Record<string, string>>;

  constructor(
    table: string,
    type: "update" | "delete" | "insert",
    payload: unknown,
    state: {
      calls: Array<{ table: string; type: string; payload: unknown; filters: Record<string, string> }>;
    },
    failures: Partial<Record<string, string>>,
  ) {
    this.table = table;
    this.type = type;
    this.payload = payload;
    this.state = state;
    this.failures = failures;
  }

  async eq(column: string, value: string): Promise<QueryResult> {
    this.filters.set(column, value);
    return this.finish();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.finish().then(onfulfilled, onrejected);
  }

  private async finish(): Promise<QueryResult> {
    const filters = Object.fromEntries(this.filters.entries());
    this.state.calls.push({
      table: this.table,
      type: this.type,
      payload: this.payload,
      filters,
    });

    const failure = this.failures[`${this.table}:${this.type}`];
    return {
      error: failure ? { message: failure } : null,
    };
  }
}

class FakeSupabase {
  readonly state = {
    calls: [] as Array<{ table: string; type: string; payload: unknown; filters: Record<string, string> }>,
  };
  private readonly failures: Partial<Record<string, string>>;

  constructor(failures: Partial<Record<string, string>> = {}) {
    this.failures = failures;
  }

  from(table: string) {
    return {
      update: (payload: unknown) =>
        new FakeTableOperation(table, "update", payload, this.state, this.failures),
      delete: () =>
        new FakeTableOperation(table, "delete", null, this.state, this.failures),
      insert: (payload: unknown) =>
        new FakeTableOperation(table, "insert", payload, this.state, this.failures),
    };
  }
}

function createSnapshot(): PartnerUpdateRollbackSnapshot {
  return {
    company_id: "company-1",
    category_id: "category-1",
    name: "기존 제휴처",
    location: "서울",
    detail_description: "이전 설명",
    campus_slugs: ["seoul"],
    map_url: "https://example.com/map",
    benefit_action_type: "external_link",
    benefit_action_link: "https://example.com/benefit",
    benefit_verification_pin_hash: "hash",
    benefit_verification_pin_salt: "salt",
    reservation_link: "https://example.com/reserve",
    inquiry_link: "https://example.com/inquiry",
    period_start: "2026-07-01",
    period_end: "2026-12-31",
    conditions: ["학생증 제시"],
    benefits: ["혜택 A", "혜택 B"],
    applies_to: ["student"],
    thumbnail: "thumb.png",
    images: ["a.png", "b.png"],
    tags: ["태그"],
    visibility: "public",
    benefit_visibility: "public",
    partner_benefits: [
      { id: "benefit-2", title: "혜택 B", max_apply_count: 2, display_order: 1 },
      { id: "benefit-1", title: "혜택 A", max_apply_count: 1, display_order: 0 },
    ],
  };
}

test("partner update rollback restores the partner row before benefit records", async () => {
  const supabase = new FakeSupabase();

  await rollbackPartnerUpdateMutation({
    supabase: supabase as never,
    partnerId: "partner-1",
    previousPartner: createSnapshot(),
  });

  assert.deepEqual(
    supabase.state.calls.map((call) => `${call.table}:${call.type}`),
    [
      "partners:update",
      "partner_benefits:delete",
      "partner_benefits:insert",
    ],
  );
  assert.equal(supabase.state.calls[0]?.filters.id, "partner-1");
  assert.equal(supabase.state.calls[1]?.filters.partner_id, "partner-1");
  assert.deepEqual(supabase.state.calls[2]?.payload, [
    {
      id: "benefit-1",
      partner_id: "partner-1",
      title: "혜택 A",
      max_apply_count: 1,
      display_order: 0,
    },
    {
      id: "benefit-2",
      partner_id: "partner-1",
      title: "혜택 B",
      max_apply_count: 2,
      display_order: 1,
    },
  ]);
});

test("partner update rollback stops before benefit cleanup when partner restore fails", async () => {
  const supabase = new FakeSupabase({
    "partners:update": "update failed",
  });

  await assert.rejects(
    rollbackPartnerUpdateMutation({
      supabase: supabase as never,
      partnerId: "partner-1",
      previousPartner: createSnapshot(),
    }),
    /partner_update_rollback_failed/,
  );

  assert.deepEqual(
    supabase.state.calls.map((call) => `${call.table}:${call.type}`),
    ["partners:update"],
  );
});
