import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADMIN_REVIEW_NOTE_MAX_LENGTH } from "@/lib/admin-review-queue";
import {
  normalizePartnerBillingProfileInput,
  PARTNER_BILLING_FIELD_LIMITS,
} from "@/lib/partner-billing";
import {
  normalizePlanUpgradeMemo,
  normalizePlanUpgradePayerName,
  PARTNER_PLAN_UPGRADE_MEMO_MAX_LENGTH,
} from "@/lib/partner-plan-upgrades";
import {
  parseShowcaseExclusionReason,
  parseShowcaseProjectSubmission,
  parseShowcaseReview,
  SHOWCASE_PROJECT_LIMITS,
} from "@/lib/project-showcase/validation";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const VALID_SHOWCASE_INPUT = {
  projectType: "web",
  title: "싸피 제휴 지도",
  teamName: "",
  summary: "역삼 제휴처를 한눈에 보는 지도",
  description: "역삼역 인근 제휴처의 위치와 혜택을 지도에서 찾아볼 수 있는 서비스입니다.",
  serviceUrl: "https://example.com",
  imageUploadId: null,
  announcementConsent: true,
};

test("쇼케이스 입력 길이 상수는 기존 서버 스키마 경계와 같다", () => {
  assert.deepEqual(SHOWCASE_PROJECT_LIMITS, {
    titleMin: 2,
    titleMax: 100,
    teamNameMax: 60,
    summaryMin: 5,
    summaryMax: 240,
    descriptionMin: 20,
    descriptionMax: 8000,
    serviceUrlMax: 2048,
    reviewNoteMax: 2000,
    exclusionReasonMin: 2,
    exclusionReasonMax: 500,
    ownerSearchMin: 2,
    ownerSearchMax: 50,
  });

  const options = { requireImage: false };
  assert.equal(parseShowcaseProjectSubmission(VALID_SHOWCASE_INPUT, options).success, true);
  assert.equal(
    parseShowcaseProjectSubmission({ ...VALID_SHOWCASE_INPUT, title: "가".repeat(SHOWCASE_PROJECT_LIMITS.titleMax) }, options).success,
    true,
  );
  const tooLong = parseShowcaseProjectSubmission(
    { ...VALID_SHOWCASE_INPUT, title: "가".repeat(SHOWCASE_PROJECT_LIMITS.titleMax + 1) },
    options,
  );
  assert.deepEqual(tooLong.success ? null : [tooLong.field, tooLong.message], ["title", "서비스 이름은 100자 이하로 입력해 주세요."]);

  const longNote = parseShowcaseReview({ status: "rejected", reviewNote: "가".repeat(SHOWCASE_PROJECT_LIMITS.reviewNoteMax + 1) });
  assert.equal(longNote.success ? null : longNote.message, "검수 사유는 2000자 이하로 입력해 주세요.");

  assert.equal(parseShowcaseExclusionReason("가".repeat(SHOWCASE_PROJECT_LIMITS.exclusionReasonMax)).success, true);
  const longReason = parseShowcaseExclusionReason("가".repeat(SHOWCASE_PROJECT_LIMITS.exclusionReasonMax + 1));
  assert.equal(longReason.success ? null : longReason.message, "제외 사유를 2자 이상 500자 이하로 입력해 주세요.");
});

test("청구 프로필·플랜 요청 길이 상수는 서버 정규화와 같은 경계를 쓴다", () => {
  assert.deepEqual(PARTNER_BILLING_FIELD_LIMITS, {
    profileLabel: 80,
    payerName: 80,
    businessRegistrationNumberInput: 12,
    businessName: 120,
    representativeName: 80,
    businessAddress: 300,
    businessType: 80,
    businessItem: 120,
    taxInvoiceEmail: 254,
  });
  assert.equal(PARTNER_PLAN_UPGRADE_MEMO_MAX_LENGTH, 1_000);

  const profile = {
    businessRegistrationNumber: "220-81-62517",
    businessName: "가".repeat(PARTNER_BILLING_FIELD_LIMITS.businessName),
    representativeName: "홍길동",
    businessAddress: "서울특별시 강남구 테헤란로",
    businessType: "서비스",
    businessItem: "소프트웨어",
    taxInvoiceEmail: "tax@example.com",
  };
  assert.equal(normalizePartnerBillingProfileInput(profile).businessName.length, 120);
  assert.throws(
    () => normalizePartnerBillingProfileInput({ ...profile, businessName: "가".repeat(121) }),
    /상호은 120자 이하로 입력해 주세요\./,
  );
  assert.throws(() => normalizePlanUpgradePayerName("가".repeat(81)), /입금자명은 80자 이하로 입력해 주세요\./);
  assert.throws(() => normalizePlanUpgradeMemo("가".repeat(1_001)), /요청 메모는 1,000자 이하로 입력해 주세요\./);
});

test("관리자 검토 사유 상한은 500자이고 검토 화면과 액션이 같은 상수를 쓴다", () => {
  assert.equal(ADMIN_REVIEW_NOTE_MAX_LENGTH, 500);
  for (const path of [
    "src/components/admin/AdminGraduateVerificationQueue.tsx",
    "src/components/admin/AdminMemberSignupApprovalDetail.tsx",
    "src/components/admin/AdminProfilePhotoReviewQueue.tsx",
    "src/components/admin/member-detail/AdminMemberProfilePhotoPanel.tsx",
    "src/app/admin/(protected)/profile-photos/actions.ts",
    "src/app/admin/(protected)/member-signup-requests/actions.ts",
    "src/lib/graduate-verification-service.ts",
  ]) {
    const source = readSource(path);
    assert.match(source, /ADMIN_REVIEW_NOTE_MAX_LENGTH/, path);
    assert.doesNotMatch(source, /maxLength=\{500\}|length > 500\b/, path);
  }
});

test("길이 상한이 있는 폼은 서버 상수를 maxLength로 참조한다", () => {
  const cases: Array<[string, RegExp]> = [
    ["src/components/project-showcase/ShowcaseProjectForm.tsx", /maxLength=\{(?:100|60|240|8000|2048)\}/],
    ["src/components/admin/ShowcaseAdminProjectForm.tsx", /maxLength=\{(?:50|100|60|240|8000|2048|2000)\}/],
    ["src/components/admin/ShowcaseProjectReviewForm.tsx", /maxLength=\{2000\}/],
    ["src/components/admin/ShowcaseDrawControls.tsx", /maxLength=\{500\}/],
    ["src/components/partner/PartnerAccountInfoView.tsx", /maxLength=\{(?:12|80|120|254|300)\}/],
    ["src/components/partner/PartnerPlanUpgradeForm.tsx", /maxLength=\{1000\}/],
    ["src/components/admin/AdminNotificationTemplateManager.tsx", /maxLength=\{(?:2000|20000)\}/],
  ];
  for (const [path, literal] of cases) {
    assert.doesNotMatch(readSource(path), literal, path);
  }
});
