import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolvePartnerCreateInsertOutcome } from "../src/lib/partner-create-idempotency.ts";

test("성공한 제휴처 생성은 기존 행 조회나 정리를 실행하지 않는다", async () => {
  let lookupCount = 0;
  let cleanupCount = 0;

  const outcome = await resolvePartnerCreateInsertOutcome({
    insertError: null,
    loadExistingPartner: async () => {
      lookupCount += 1;
      return { exists: false, error: null };
    },
    cleanupDuplicateAttempt: async () => {
      cleanupCount += 1;
    },
  });

  assert.equal(outcome, "created");
  assert.equal(lookupCount, 0);
  assert.equal(cleanupCount, 0);
});

test("같은 멱등 키 재시도는 이번 시도의 부작용을 정리하고 중단한다", async () => {
  let cleanupCount = 0;

  const outcome = await resolvePartnerCreateInsertOutcome({
    insertError: { code: "23505", message: "duplicate partner" },
    loadExistingPartner: async () => ({ exists: true, error: null }),
    cleanupDuplicateAttempt: async () => {
      cleanupCount += 1;
    },
  });

  assert.equal(outcome, "duplicate");
  assert.equal(cleanupCount, 1);
});

test("중복 오류인데 기존 멱등 행이 없으면 원래 저장 오류를 유지한다", async () => {
  let cleanupCount = 0;

  await assert.rejects(
    resolvePartnerCreateInsertOutcome({
      insertError: { code: "23505", message: "duplicate partner" },
      loadExistingPartner: async () => ({ exists: false, error: null }),
      cleanupDuplicateAttempt: async () => {
        cleanupCount += 1;
      },
    }),
    /duplicate partner/,
  );
  assert.equal(cleanupCount, 0);
});

test("관리자 생성 action은 중복 재시도를 지점 저장 전에 반환한다", async () => {
  const source = await readFile(
    new URL(
      "../src/app/admin/(protected)/_actions/partner-actions/create.ts",
      import.meta.url,
    ),
    "utf8",
  );

  const duplicateReturn = source.indexOf('insertOutcome === "duplicate"');
  const benefitWrite = source.indexOf('from("partner_benefits")');
  const branchWrite = source.indexOf("persistPartnerBranchLinks({");

  assert.ok(duplicateReturn >= 0);
  assert.ok(duplicateReturn < benefitWrite);
  assert.ok(duplicateReturn < branchWrite);
  assert.match(
    source,
    /cleanupDuplicateAttempt:[\s\S]*cleanupPartnerCreateAttempt\([\s\S]*companyProvision: null/,
  );
});
