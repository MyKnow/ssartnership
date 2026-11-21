import assert from "node:assert/strict";
import test from "node:test";

import { cancelSupabaseRequest } from "../src/lib/partner-change-requests/commands/cancel.ts";
import type { PartnerChangeRequestSupabaseClient } from "../src/lib/partner-change-requests/shared.ts";

type QueryCall = {
  table: string;
  operation: "select" | "update";
  values: unknown;
  filters: Array<[string, unknown]>;
};

function createRequestRow(status: string) {
  return {
    id: "request-1",
    company_id: "company-1",
    partner_id: "partner-1",
    status,
    current_partner_name: "싸피 식당",
    current_partner_location: "서울 강남구",
    // Keep requested media empty so the success path never reaches Storage.
    requested_thumbnail: null,
    requested_images: [],
    requested_by_account_id: "account-1",
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function createSupabaseStub(options: { updateMatches: boolean }) {
  const calls: QueryCall[] = [];
  let currentStatus = "pending";

  function from(table: string) {
    const call: QueryCall = { table, operation: "select", values: null, filters: [] };
    let mutation = false;
    const respond = () => {
      calls.push(call);
      if (table === "partner_change_requests" && call.operation === "update") {
        if (!options.updateMatches) {
          return Promise.resolve({ data: null, error: null });
        }
        currentStatus = "cancelled";
        return Promise.resolve({ data: { id: "request-1" }, error: null });
      }
      if (table === "partner_change_requests") {
        return Promise.resolve({ data: createRequestRow(currentStatus), error: null });
      }
      if (table === "partners") {
        return Promise.resolve({ data: { thumbnail: null, images: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };
    const builder = {
      select: () => {
        if (!mutation) {
          call.operation = "select";
        }
        return builder;
      },
      update: (values: unknown) => {
        mutation = true;
        call.operation = "update";
        call.values = values;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      },
      maybeSingle: respond,
    };
    return builder;
  }

  return {
    client: { from } as unknown as PartnerChangeRequestSupabaseClient,
    calls,
  };
}

const input = {
  requestId: "request-1",
  accountId: "account-1",
  companyIds: ["company-1"],
};

test("변경 요청 취소는 대기 상태 조건으로만 갱신한다", async () => {
  const { client, calls } = createSupabaseStub({ updateMatches: true });

  const cancelled = await cancelSupabaseRequest(input, client);

  assert.equal(cancelled.status, "cancelled");
  const update = calls.find((call) => call.operation === "update");
  assert.deepEqual(update?.filters, [
    ["id", "request-1"],
    ["status", "pending"],
  ]);
});

test("승인과 경합해 대기 상태가 아니게 되면 이미 처리된 요청으로 중단하고 미디어를 건드리지 않는다", async () => {
  const { client, calls } = createSupabaseStub({ updateMatches: false });

  await assert.rejects(cancelSupabaseRequest(input, client), (error: unknown) => {
    assert.equal((error as { code?: string }).code, "already_resolved");
    return true;
  });

  const updateIndex = calls.findIndex((call) => call.operation === "update");
  assert.ok(updateIndex >= 0);
  assert.equal(
    calls.length,
    updateIndex + 1,
    "경합에서 지면 취소 결과 재조회와 미디어 정리를 실행하지 않는다",
  );
});
