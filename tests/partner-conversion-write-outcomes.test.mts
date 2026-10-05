import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { PartnerMutationOutcomeUnknownError } from "../src/lib/partner-admin/mutation-outcome.ts";
import {
  createPartnerFromPortalRegistrationRequest,
  PartnerRegistrationConversionCleanupError,
  type PartnerRegistrationRequestRow,
} from "../src/lib/partner-registration-conversion.server.ts";
import {
  cleanupPartnerCompanyProvision,
  ensurePartnerCompanyRow,
} from "../src/app/admin/(protected)/_actions/partner-support/company-provision.ts";

type Failure = { request: string; mode: "timeout" | "late" | "503" | "400" | "empty404" | "array404" | "partial200" | "unexpected200" | "duplicate200" | "null200" | "wrongRestore" | "partialForward200" | "duplicateForward200" | "unexpectedForward200" | "409race"; after?: number };

function fixture(failures: Failure[], existingAccount = false, multiplePartners = false, multipleBenefits = false) {
  const calls: string[] = [];
  const committed: string[] = [];
  const deferred: Array<() => void> = [];
  const partnerIds: string[] = [];
  let storedBranches: Array<{ id: string; branch_key: string }> = [];
  const remaining = [...failures];
  const account = { id: "account-fixture", login_id: "fixture@example.invalid", display_name: "fixture", is_active: false };
  const supabase = createClient("https://fixture.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const table = new URL(String(input)).pathname.split("/").at(-1)!;
        const method = init?.method ?? "GET";
        const key = `${method} ${table}`;
        calls.push(key);
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        const commit = () => {
          committed.push(key);
          if (table === "partners" && method === "POST") partnerIds.push(body.id);
          if (table === "partner_company_branches" && method === "POST") {
            storedBranches = body.map((row: { branch_key: string }, index: number) => ({ id: `branch-${index}`, branch_key: row.branch_key }));
          }
        };
        const failureIndex = remaining.findIndex((failure) => failure.request === key
          && calls.filter((call) => call === key).length > (failure.after ?? 0));
        if (failureIndex !== -1) {
          const [failure] = remaining.splice(failureIndex, 1);
          if (failure.mode === "400") {
            return new Response(JSON.stringify({ code: "23514", message: "fixture constraint rejection" }), { status: 400 });
          }
          if (failure.mode === "empty404") return new Response(null, { status: 404 });
          if (failure.mode === "array404") return new Response("[]", { status: 404 });
          if (failure.mode === "partial200") return new Response(JSON.stringify([{ id: partnerIds[0] }]));
          if (failure.mode === "unexpected200") return new Response(JSON.stringify([{ id: partnerIds[0] }, { id: "unexpected" }]));
          if (failure.mode === "duplicate200") return new Response(JSON.stringify([{ id: partnerIds[0] }, { id: partnerIds[0] }]));
          if (failure.mode === "null200") return new Response("null");
          if (failure.mode === "wrongRestore") return new Response(JSON.stringify([{ ...account, ...body, is_active: true }]));
          const receiptRows = Array.isArray(body) ? body : [body];
          if (failure.mode === "partialForward200") return new Response(JSON.stringify(receiptRows.slice(0, -1)));
          if (failure.mode === "duplicateForward200") return new Response(JSON.stringify([receiptRows[0], receiptRows[0]]));
          if (failure.mode === "unexpectedForward200") return new Response(JSON.stringify(receiptRows.map((row) => ({
            ...row, partner_id: "unexpected", company_id: "unexpected", account_id: "unexpected", branch_key: "unexpected", branch_id: "unexpected",
          }))));
          if (failure.mode === "409race") {
            storedBranches = receiptRows.map((row, index) => ({ id: `concurrent-${index}`, branch_key: row.branch_key }));
            return new Response(JSON.stringify({ code: "23505", message: "fixture concurrent branch" }), { status: 409 });
          }
          if (method !== "GET") {
            if (failure.mode === "late") deferred.push(commit);
            else commit();
          }
          if (failure.mode === "503") {
            return new Response(JSON.stringify({ message: "fixture gateway unavailable" }), { status: 503 });
          }
          throw new DOMException("fixture response deadline", "TimeoutError");
        }
        if (method === "GET") {
          let rows: unknown[] = [];
          if (table === "partner_accounts" && existingAccount) rows = [account];
          if (table === "partner_registration_benefit_groups" && multiplePartners) rows = [
            { group_key: "G01", label: "one", benefits: ["first"] },
            { group_key: "G02", label: "two", benefits: ["second"] },
          ];
          if (table === "partner_registration_branches") rows = [{
            benefit_group_key: "G01", branch_key: "branch-key", name: "fixture", address: "서울", campus_slugs: ["seoul"],
          }];
          if (table === "partner_company_branches") rows = storedBranches;
          return new Response(JSON.stringify(rows));
        }
        commit();
        if (method === "DELETE") {
          if (!new URL(String(input)).searchParams.has("select")) return new Response(null, { status: 204 });
          const rows = table === "partners" ? partnerIds.map((id) => ({ id }))
            : table === "partner_account_companies" ? [{ account_id: account.id, company_id: "company-fixture" }]
              : [{ id: table === "partner_companies" ? "company-fixture" : table === "partner_brand_profiles" ? "brand-fixture" : account.id }];
          return new Response(JSON.stringify(rows));
        }
        if (table === "partner_companies") return new Response(JSON.stringify({ ...body, id: "company-fixture" }), { status: 201 });
        if (table === "partner_accounts") {
          const row = { ...account, ...body };
          const singular = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
          return new Response(JSON.stringify(singular ? row : [row]), { status: method === "POST" ? 201 : 200 });
        }
        if (table === "partner_brand_profiles") return new Response(JSON.stringify({ ...body, id: "brand-fixture" }), { status: 201 });
        if (table === "partners") return new Response(JSON.stringify(body), { status: 201 });
        if (new URL(String(input)).searchParams.has("select")) {
          const rows = Array.isArray(body) ? body : [body];
          return new Response(JSON.stringify(table === "partner_company_branches"
            ? rows.map((row, index) => ({ ...row, id: `branch-${index}` })) : rows), { status: 201 });
        }
        return new Response(null, { status: 201 });
      },
    },
  });
  const request: PartnerRegistrationRequestRow = {
    id: "request-fixture", status: "pending", source: "public_web", company_id: null,
    brand_name: "fixture partner", location: "서울", category_id: "category-fixture",
    category_label: "fixture", service_mode: "offline", benefit_action_type: "none",
    company_name: "fixture company", contact_name: "fixture", contact_email: "fixture@example.invalid",
    benefits: multipleBenefits ? ["first", "second"] : ["fixture benefit"], conditions: [], company: { managed_campus_slugs: ["seoul"] },
  };
  return {
    calls, committed, deferred,
    run: () => createPartnerFromPortalRegistrationRequest({
      supabase, request, campusSlugs: ["seoul"],
      companyProvisioner: {
        ensure: (client, input, options) => ensurePartnerCompanyRow(client, input, true, options),
        cleanup: cleanupPartnerCompanyProvision,
      },
    }),
  };
}

const mutationRequests = [
  "POST partner_companies", "POST partner_accounts", "PATCH partner_accounts",
  "POST partner_account_companies", "POST partner_brand_profiles", "POST partners",
  "POST partner_benefits", "POST partner_company_branches", "POST partner_offer_branches",
];

for (const request of mutationRequests) {
  for (const mode of ["timeout", "503", "late"] as const) {
    test(`${request}: ${mode} 결과 불확실성은 실제 SDK를 거쳐 자동 정리 없이 전파된다`, async () => {
      const state = fixture([{ request, mode }], request.startsWith("PATCH"));
      await assert.rejects(state.run(), (error: unknown) => {
        assert.ok(error instanceof PartnerMutationOutcomeUnknownError);
        return true;
      });
      assert.equal(state.calls.at(-1), request, "no compensating write or retry after an uncertain mutation");
      state.deferred.forEach((commit) => commit());
      assert.ok(state.committed.includes(request), "commit may precede or follow response failure");
    });
  }
}

for (const request of ["POST partner_account_companies", "POST partner_benefits", "POST partner_company_branches", "POST partner_offer_branches"]) {
  for (const mode of ["null200", "partialForward200", "duplicateForward200", "unexpectedForward200"] as const) {
    test(`${request}: ${mode}는 일부 연결·혜택 저장을 완료로 만들지 않는다`, async () => {
      const state = fixture([{ request, mode }], false, false, request === "POST partner_benefits");
      await assert.rejects(state.run(), PartnerMutationOutcomeUnknownError);
      assert.equal(state.calls.at(-1), request);
    });
  }
}

test("지점 23505 경합은 기존 재조회로 승자 행을 확인하고 연결한다", async () => {
  const state = fixture([{ request: "POST partner_company_branches", mode: "409race" }]);
  const result = await state.run();
  assert.equal(result.partners.length, 1);
  assert.equal(state.calls.filter((call) => call === "POST partner_company_branches").length, 1);
  assert.equal(state.calls.at(-1), "POST partner_offer_branches");
});

for (const request of mutationRequests) {
  for (const mode of ["empty404", "array404"] as const) {
    test(`${request}: forward ${mode}에서 필요한 저장 행이 확인되지 않으면 완료하지 않는다`, async () => {
      const state = fixture([{ request, mode }], request.startsWith("PATCH"));
      await assert.rejects(state.run(), PartnerMutationOutcomeUnknownError);
      assert.equal(state.calls.at(-1), request, "no follow-up or compensation after an unproven write");
    });
  }
}

test("확정 HTTP400 쓰기 거절은 기존 리소스 보상 처리를 유지한다", async () => {
  const state = fixture([{ request: "POST partner_benefits", mode: "400" }]);
  await assert.rejects(state.run(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "Error");
    assert.match(error.message, /fixture constraint rejection/);
    return true;
  });
  assert.deepEqual(state.calls.slice(-5), [
    "DELETE partners", "DELETE partner_brand_profiles", "DELETE partner_account_companies",
    "DELETE partner_accounts", "DELETE partner_companies",
  ]);
});

test("조회 timeout은 쓰기 불확실성으로 오인하지 않고 알려진 회사 생성을 정리한다", async () => {
  const state = fixture([{ request: "GET partner_accounts", mode: "timeout" }]);
  await assert.rejects(state.run(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "Error");
    return true;
  });
  assert.equal(state.calls.at(-1), "DELETE partner_companies");
});

test("회사 프로비저닝의 확정 보상 실패도 전환 helper 밖으로 typed cleanup 오류를 전달한다", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const state = fixture([
    { request: "POST partner_account_companies", mode: "400" },
    { request: "DELETE partner_accounts", mode: "400" },
  ]);
  await assert.rejects(state.run(), PartnerRegistrationConversionCleanupError);
  assert.equal(state.calls.filter((call) => call === "DELETE partner_companies").length, 1);
});

for (const request of ["DELETE partners", "DELETE partner_accounts"]) {
  test(`${request}: 정리 응답이 불확실하면 이후 자동 정리도 중단한다`, async () => {
    const state = fixture([
      { request: request === "DELETE partners" ? "POST partner_benefits" : "POST partner_account_companies", mode: "400" },
      { request, mode: "timeout" },
    ]);
    await assert.rejects(state.run(), (error: unknown) => {
      assert.ok(error instanceof PartnerMutationOutcomeUnknownError);
      return true;
    });
    assert.equal(state.calls.at(-1), request);
  });
}

for (const request of [
  "DELETE partner_brand_profiles", "DELETE partner_account_companies",
  "DELETE partner_accounts", "DELETE partner_companies", "PATCH partner_accounts",
]) {
  test(`${request}: 완료한 프로비저닝의 보상 쓰기도 불확실하면 남은 정리를 중단한다`, async () => {
    const restoringAccount = request.startsWith("PATCH");
    const state = fixture([
      { request: "POST partner_benefits", mode: "400" },
      { request, mode: "timeout", after: restoringAccount ? 1 : 0 },
    ], restoringAccount);
    await assert.rejects(state.run(), PartnerMutationOutcomeUnknownError);
    assert.equal(state.calls.at(-1), request);
  });
}

for (const mode of ["partial200", "unexpected200", "duplicate200", "null200"] as const) {
  test(`partner cleanup: ${mode} HTTP200 본문만으로 전체 삭제를 확정하지 않는다`, async () => {
    const state = fixture([
      { request: "POST partner_benefits", mode: "400", after: 1 },
      { request: "DELETE partners", mode },
    ], false, true);
    await assert.rejects(state.run(), PartnerMutationOutcomeUnknownError);
    assert.equal(state.calls.at(-1), "DELETE partners");
    assert.equal(state.committed.filter((call) => call === "POST partners").length, 2);
  });
}

test("계정 restore 응답의 ID가 같아도 저장한 값과 다르면 완료로 판정하지 않는다", async () => {
  const state = fixture([
    { request: "POST partner_benefits", mode: "400" },
    { request: "PATCH partner_accounts", mode: "wrongRestore", after: 1 },
  ], true);
  await assert.rejects(state.run(), PartnerMutationOutcomeUnknownError);
  assert.equal(state.calls.at(-1), "PATCH partner_accounts");
});

for (const request of [
  "DELETE partners", "DELETE partner_brand_profiles", "DELETE partner_account_companies",
  "DELETE partner_accounts", "DELETE partner_companies", "PATCH partner_accounts",
]) {
  for (const mode of ["empty404", "array404"] as const) {
    test(`${request}: SDK가 정규화한 ${mode}는 보상 완료 증거가 아니다`, async () => {
      const restoringAccount = request.startsWith("PATCH");
      const state = fixture([
        { request: "POST partner_benefits", mode: "400" },
        { request, mode, after: restoringAccount ? 1 : 0 },
      ], restoringAccount);
      await assert.rejects(state.run(), PartnerMutationOutcomeUnknownError);
      assert.equal(state.calls.at(-1), request);
      assert.ok(state.committed.includes("POST partners"));
    });
  }
}
