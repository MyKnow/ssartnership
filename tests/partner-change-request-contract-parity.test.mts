import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const contractsPromise = import(
  new URL(
    "../src/lib/partner-change-requests/contracts.ts",
    import.meta.url,
  ).href
);
const validationPromise = import(
  new URL("../src/lib/validation.ts", import.meta.url).href
);

function createValidInput() {
  return {
    companyIds: ["company-id"],
    partnerId: "partner-id",
    requestedByAccountId: "account-id",
    requestedByLoginId: "partner@example.com",
    requestedByDisplayName: "파트너",
    requestedPartnerName: "제휴처",
    requestedPartnerLocation: "서울 강남구",
    requestedMapUrl: null,
    requestedDetailDescription: null,
    requestedCampusSlugs: ["seoul" as const],
    requestedConditions: [],
    requestedBenefits: [],
    requestedAppliesTo: ["student" as const],
    requestedTags: [],
    requestedThumbnail: null,
    requestedImages: [],
    requestedReservationLink: null,
    requestedInquiryLink: null,
    requestedPeriodStart: "2026-08-31",
    requestedPeriodEnd: "2026-09-30",
  };
}

test("mock과 Supabase 변경 요청 생성은 같은 정규화·검증 계약을 사용한다", async () => {
  const [supabaseCreate, mockCommands] = await Promise.all([
    readSource("src/lib/partner-change-requests/commands/create.ts"),
    readSource("src/lib/mock/partner-change-requests/commands.ts"),
  ]);

  for (const source of [supabaseCreate, mockCommands]) {
    assert.match(source, /normalizePartnerChangeRequestCreateFields\(input\)/);
    assert.match(source, /assertPartnerChangeRequestHasChanges\(/);
  }
});

test("mock과 Supabase 쓰기 경계는 감사 문맥을 같은 필수 계약으로 검증한다", async () => {
  const [shared, supabaseImmediate, supabaseReview, mockImmediate, mockCommands] =
    await Promise.all([
      readSource("src/lib/partner-change-requests/shared.ts"),
      readSource("src/lib/partner-change-requests/immediate.ts"),
      readSource("src/lib/partner-change-requests/commands/review.ts"),
      readSource("src/lib/mock/partner-change-requests/immediate.ts"),
      readSource("src/lib/mock/partner-change-requests/commands.ts"),
    ]);

  assert.doesNotMatch(shared, /auditContext\?: AtomicAuditContext/);
  assert.equal(
    [supabaseImmediate, supabaseReview, mockImmediate, mockCommands].every((source) =>
      source.includes("requirePartnerChangeRequestAuditContext"),
    ),
    true,
  );
});

test("mock 정규화기는 공용 변경 요청 정규화기를 재사용한다", async () => {
  const source = await readSource(
    "src/lib/mock/partner-change-requests/normalizers.ts",
  );

  assert.match(source, /from ["']\.\.\/\.\.\/partner-change-requests\/normalizers\.ts["']/);
  assert.doesNotMatch(source, /export function normalizeTextList/);
  assert.doesNotMatch(source, /export function arraysEqual/);
});

test("공용 날짜 계약은 실제 달력에 없는 날짜를 저장소 전에 거부한다", async () => {
  const [{ normalizePartnerChangeRequestCreateFields }, { validateDateRange }] =
    await Promise.all([contractsPromise, validationPromise]);

  for (const invalidDate of ["2026-02-31", "2026-13-01", "0000-00-00"]) {
    assert.match(
      validateDateRange(invalidDate, null) ?? "",
      /제휴 시작일 형식을 확인해 주세요/,
    );
    assert.throws(
      () =>
        normalizePartnerChangeRequestCreateFields({
          ...createValidInput(),
          requestedPeriodStart: invalidDate,
        }),
      /제휴 시작일 형식을 확인해 주세요/,
    );
  }

  assert.equal(validateDateRange("2024-02-29", "2024-03-01"), null);
  assert.match(
    validateDateRange("2026-02-29", null) ?? "",
    /제휴 시작일 형식을 확인해 주세요/,
  );
});

test("빈 적용 대상은 전체 대상으로 확대하지 않고 명시적으로 거부한다", async () => {
  const { normalizePartnerChangeRequestCreateFields } = await contractsPromise;

  assert.throws(
    () =>
      normalizePartnerChangeRequestCreateFields({
        ...createValidInput(),
        requestedAppliesTo: [],
      }),
    /적용 대상을 하나 이상 선택해 주세요/,
  );
});
