import assert from "node:assert/strict";
import test from "node:test";

import { rollbackCreatedPartnerPersistence } from "../src/lib/partner-create-rollback.ts";

test("제휴처 생성 롤백은 앞 단계가 실패해도 나머지 정리를 계속한다", async () => {
  const stages: string[] = [];

  await assert.rejects(
    rollbackCreatedPartnerPersistence({
      originalError: new Error("benefit_insert_failed"),
      operations: [
        {
          stage: "partner",
          run: async () => {
            stages.push("partner");
            return { error: { code: "XX001", message: "delete failed" } };
          },
        },
        {
          stage: "partner_brand_profile",
          run: async () => {
            stages.push("partner_brand_profile");
            return { error: null };
          },
        },
      ],
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "partner_create_cleanup_failed");
      return true;
    },
  );

  assert.deepEqual(stages, ["partner", "partner_brand_profile"]);
});

test("제휴처 생성 롤백은 쿼리 예외 후에도 다음 정리를 계속한다", async () => {
  const stages: string[] = [];

  await assert.rejects(
    rollbackCreatedPartnerPersistence({
      originalError: new Error("benefit_insert_failed"),
      operations: [
        {
          stage: "partner",
          run: async () => {
            stages.push("partner");
            throw new Error("transport failed");
          },
        },
        {
          stage: "partner_brand_profile",
          run: async () => {
            stages.push("partner_brand_profile");
            return { error: null };
          },
        },
      ],
    }),
    /partner_create_cleanup_failed/,
  );

  assert.deepEqual(stages, ["partner", "partner_brand_profile"]);
});
