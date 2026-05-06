import assert from "node:assert/strict";
import test from "node:test";

type BenefitVisibilityModule =
  typeof import("../src/lib/partner-benefit-visibility.ts");
type PartnerAudienceModule = typeof import("../src/lib/partner-audience.ts");
type MockPartnerRepositoryModule =
  typeof import("../src/lib/repositories/mock/partner-repository.mock.ts");

const benefitVisibilityPromise = import(
  new URL("../src/lib/partner-benefit-visibility.ts", import.meta.url).href,
) as Promise<BenefitVisibilityModule>;
const partnerAudiencePromise = import(
  new URL("../src/lib/partner-audience.ts", import.meta.url).href,
) as Promise<PartnerAudienceModule>;
const mockPartnerRepositoryPromise = import(
  new URL("../src/lib/repositories/mock/partner-repository.mock.ts", import.meta.url).href,
) as Promise<MockPartnerRepositoryModule>;

test("benefit visibility masks eligible-only benefits for logged out users", async () => {
  const {
    BENEFIT_LOGIN_REQUIRED_MESSAGE,
    maskPartnerBenefitsForAccess,
  } = await benefitVisibilityPromise;

  const partner = {
    id: "partner-1",
    name: "테스트 제휴",
    category: "health",
    visibility: "public" as const,
    benefitVisibility: "eligible_only" as const,
    createdAt: "2026-05-01T00:00:00.000Z",
    location: "서울",
    reservationLink: "https://reserve.example.com",
    period: { start: "2026-05-01", end: "2026-12-31" },
    conditions: ["SSAFY 인증 화면 제시"],
    benefits: ["10% 할인"],
    appliesTo: ["student" as const],
  };

  const masked = maskPartnerBenefitsForAccess(partner, {
    authenticated: false,
  });

  assert.equal(masked.benefitAccessStatus, "login_required");
  assert.equal(masked.reservationLink, undefined);
  assert.deepEqual(masked.benefits, [BENEFIT_LOGIN_REQUIRED_MESSAGE]);
  assert.deepEqual(masked.conditions, [BENEFIT_LOGIN_REQUIRED_MESSAGE]);
});

test("benefit visibility masks eligible-only benefits for non-eligible users", async () => {
  const {
    BENEFIT_ELIGIBLE_ONLY_MESSAGE,
    maskPartnerBenefitsForAccess,
  } = await benefitVisibilityPromise;

  const partner = {
    id: "partner-1",
    name: "테스트 제휴",
    category: "health",
    visibility: "public" as const,
    benefitVisibility: "eligible_only" as const,
    createdAt: "2026-05-01T00:00:00.000Z",
    location: "서울",
    reservationLink: "https://reserve.example.com",
    period: { start: "2026-05-01", end: "2026-12-31" },
    conditions: ["SSAFY 인증 화면 제시"],
    benefits: ["10% 할인"],
    appliesTo: ["student" as const],
  };

  const masked = maskPartnerBenefitsForAccess(partner, {
    authenticated: true,
    viewerAudience: "graduate",
  });

  assert.equal(masked.benefitAccessStatus, "not_eligible");
  assert.equal(masked.reservationLink, undefined);
  assert.deepEqual(masked.benefits, [BENEFIT_ELIGIBLE_ONLY_MESSAGE]);
  assert.deepEqual(masked.conditions, [BENEFIT_ELIGIBLE_ONLY_MESSAGE]);
});

test("benefit visibility preserves eligible-only benefits for eligible users", async () => {
  const { maskPartnerBenefitsForAccess } = await benefitVisibilityPromise;

  const partner = {
    id: "partner-1",
    name: "테스트 제휴",
    category: "health",
    visibility: "public" as const,
    benefitVisibility: "eligible_only" as const,
    createdAt: "2026-05-01T00:00:00.000Z",
    location: "서울",
    reservationLink: "https://reserve.example.com",
    period: { start: "2026-05-01", end: "2026-12-31" },
    conditions: ["SSAFY 인증 화면 제시"],
    benefits: ["10% 할인"],
    appliesTo: ["student" as const],
  };

  const visible = maskPartnerBenefitsForAccess(partner, {
    authenticated: true,
    viewerAudience: "student",
  });

  assert.equal(visible.reservationLink, "https://reserve.example.com");
  assert.equal(visible.benefitAccessStatus, undefined);
  assert.deepEqual(visible.benefits, ["10% 할인"]);
  assert.deepEqual(visible.conditions, ["SSAFY 인증 화면 제시"]);
});

test("member year maps to partner audience for benefit eligibility", async () => {
  const { resolvePartnerAudienceFromMemberYear } = await partnerAudiencePromise;

  assert.equal(resolvePartnerAudienceFromMemberYear(0), "staff");
  assert.equal(resolvePartnerAudienceFromMemberYear(15), "student");
  assert.equal(resolvePartnerAudienceFromMemberYear(13), "graduate");
  assert.equal(resolvePartnerAudienceFromMemberYear(null), null);
});

test("member year audience follows the current SSAFY lifecycle", async () => {
  const { resolvePartnerAudienceFromMemberYear } = await partnerAudiencePromise;

  const afterNextCycleStarts = new Date("2026-07-01T00:00:00.000+09:00");

  assert.equal(
    resolvePartnerAudienceFromMemberYear(14, afterNextCycleStarts),
    "graduate",
  );
  assert.equal(
    resolvePartnerAudienceFromMemberYear(15, afterNextCycleStarts),
    "student",
  );
  assert.equal(
    resolvePartnerAudienceFromMemberYear(16, afterNextCycleStarts),
    "student",
  );
});

test("mock partner repository applies benefit masking at list boundary", async () => {
  const {
    BENEFIT_LOGIN_REQUIRED_MESSAGE,
    BENEFIT_ELIGIBLE_ONLY_MESSAGE,
  } = await benefitVisibilityPromise;
  const { MockPartnerRepository } = await mockPartnerRepositoryPromise;
  const repository = new MockPartnerRepository();

  const loggedOutPartners = await repository.getPartners({ authenticated: false });
  const loggedOutHealth = loggedOutPartners.find((partner) => partner.id === "health-001");
  assert.deepEqual(loggedOutHealth?.benefits, [BENEFIT_LOGIN_REQUIRED_MESSAGE]);

  const graduatePartners = await repository.getPartners({
    authenticated: true,
    viewerAudience: "graduate",
  });
  const graduateHealth = graduatePartners.find((partner) => partner.id === "health-001");
  assert.deepEqual(graduateHealth?.benefits, [BENEFIT_ELIGIBLE_ONLY_MESSAGE]);

  const studentPartners = await repository.getPartners({
    authenticated: true,
    viewerAudience: "student",
  });
  const studentHealth = studentPartners.find((partner) => partner.id === "health-001");
  assert.equal(studentHealth?.reservationLink, "https://booking.naver.com/");
});
