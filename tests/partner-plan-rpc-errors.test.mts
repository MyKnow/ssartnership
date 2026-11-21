import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  adminActionErrorMessages,
  getSafeAdminActionErrorCode,
} from "../src/lib/admin-action-errors.ts";
import {
  PARTNER_PLAN_RPC_ERROR_MAPPERS,
  mapPartnerPlanRpcError,
  type PartnerPlanRpcErrorMapper,
  type PartnerPlanRpcErrorMapperKey,
} from "../src/lib/partner-plan-rpc-errors.ts";
import { getSafePartnerPlanActionMessage } from "../src/lib/partner-plan-safe-messages.ts";

const mapperEntries = Object.entries(PARTNER_PLAN_RPC_ERROR_MAPPERS) as Array<
  [PartnerPlanRpcErrorMapperKey, PartnerPlanRpcErrorMapper]
>;

function getOutputs(mapper: PartnerPlanRpcErrorMapper) {
  return [...mapper.rules.map((rule) => rule.output), mapper.fallback];
}

test("파트너 대상 RPC 오류 출력은 모두 파트너 플랜 안전 문구 허용 목록에 있다", () => {
  for (const [key, mapper] of mapperEntries) {
    if (mapper.audience !== "partner") {
      continue;
    }
    for (const output of getOutputs(mapper)) {
      assert.equal(
        getSafePartnerPlanActionMessage(new Error(output), "__fallback__"),
        output,
        `${key}: ${output}`,
      );
    }
  }
});

test("관리자 대상 RPC 오류 출력은 모두 등록된 관리자 오류 코드다", () => {
  for (const [key, mapper] of mapperEntries) {
    if (mapper.audience !== "admin") {
      continue;
    }
    for (const output of getOutputs(mapper)) {
      assert.equal(
        getSafeAdminActionErrorCode(new Error(output), "__fallback__"),
        output,
        `${key}: ${output}`,
      );
      assert.ok(
        Object.hasOwn(adminActionErrorMessages, output),
        `${key}: ${output} 관리자 오류 문구가 없습니다`,
      );
    }
  }
});

test("RPC 오류 토큰은 마이그레이션이 실제로 발생시키는 이름이다", async () => {
  const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql"));
  const migrations = (
    await Promise.all(files.map((file) => readFile(new URL(file, migrationsDir), "utf8")))
  ).join("\n");

  for (const [key, mapper] of mapperEntries) {
    for (const rule of mapper.rules) {
      for (const token of rule.tokens) {
        assert.ok(migrations.includes(token), `${key}: ${token}`);
      }
    }
  }
});

test("RPC 오류 매퍼는 토큰과 SQLSTATE를 순서대로 판정하고 나머지는 fallback으로 숨긴다", () => {
  assert.equal(
    mapPartnerPlanRpcError("createUpgradeBilling", {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "partner_plan_upgrade_requests_pending_partner_idx"',
    }),
    "이미 처리 대기 중인 업그레이드 요청이 있습니다.",
  );
  assert.equal(
    mapPartnerPlanRpcError("createUpgradeBilling", {
      code: "P0001",
      message: "partner_plan_upgrade_requests_pending_partner_idx",
    }),
    "플랜 업그레이드 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  );
  assert.equal(
    mapPartnerPlanRpcError("createUpgradeBilling", {
      message: "partner_plan_billing_profile_changed",
    }),
    "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
  );
  assert.equal(
    mapPartnerPlanRpcError("partnerCancelUpgradeBilling", {
      message: "partner_plan_cancel_paid_invoice_conflict",
    }),
    "입금 확인이 완료된 청구는 취소할 수 없습니다.",
  );
  assert.equal(
    mapPartnerPlanRpcError("adminRejectUpgradeBilling", {
      message: "partner_plan_cancel_paid_invoice_conflict",
    }),
    "partner_company_plan_rejection_paid",
  );
  assert.equal(
    mapPartnerPlanRpcError("adminApproveUpgrade", {
      message: "partner_plan_approval_invoice_unpaid_conflict",
    }),
    "partner_company_plan_payment_unconfirmed",
  );
  assert.equal(
    mapPartnerPlanRpcError("adminConfirmBankTransfer", {
      message: "partner_plan_payment_invoice_cancelled",
    }),
    "partner_company_plan_invoice_cancelled",
  );
  assert.equal(
    mapPartnerPlanRpcError("adminPlanUpdate", {
      message: "partner_plan_admin_update_company_required",
    }),
    "partner_company_plan_company_required",
  );
  assert.equal(
    mapPartnerPlanRpcError("adminPlanUpdate", {
      message: 'relation "partners" does not exist',
    }),
    "partner_company_plan_update_failed",
  );
  assert.equal(
    mapPartnerPlanRpcError("adminApproveUpgrade", { message: null }),
    "partner_company_plan_approval_failed",
  );
});
