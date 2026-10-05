import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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
    ["src/components/admin/AdminGraduateVerificationQueue.tsx", /maxLength=\{160\}/],
  ];
  for (const [path, literal] of cases) {
    assert.doesNotMatch(readSource(path), literal, path);
  }
});

test("리뷰·관리자 검색·MM 가입 승인 이름 상한도 화면과 서버가 같은 상수를 쓴다", async () => {
  const { REVIEW_TEXT_LIMITS, validateReviewDraftInput } = await import("@/lib/review-validation");
  const { ADMIN_SEARCH_QUERY_MAX_LENGTH } = await import("@/lib/admin-search-query");
  const { MM_SIGNUP_DISPLAY_NAME_MAX_LENGTH } = await import("@/lib/mm-signup-approval");

  assert.deepEqual(REVIEW_TEXT_LIMITS, { titleMax: 80, bodyMin: 10, bodyMax: 2000, imagesMax: 5 });
  assert.equal(ADMIN_SEARCH_QUERY_MAX_LENGTH, 80);
  assert.equal(MM_SIGNUP_DISPLAY_NAME_MAX_LENGTH, 128);

  assert.deepEqual(
    validateReviewDraftInput({ rating: 5, title: "가".repeat(81), body: "가".repeat(2001), imageCount: 6 }),
    {
      title: "제목은 80자 이내로 입력해 주세요.",
      body: "리뷰 내용은 2000자 이내로 입력해 주세요.",
      images: "리뷰 사진은 최대 5장까지 업로드할 수 있습니다.",
    },
  );

  const disclosure = readSource("src/components/admin/review-manager/AdminReviewDetailDisclosure.tsx");
  assert.match(disclosure, /maxLength=\{REVIEW_TEXT_LIMITS\.titleMax\}/);
  assert.match(disclosure, /maxLength=\{REVIEW_TEXT_LIMITS\.bodyMax\}/);
  const reviewAction = readSource("src/app/admin/(protected)/_actions/review-actions.ts");
  assert.match(reviewAction, /title\.length > REVIEW_TEXT_LIMITS\.titleMax/);
  assert.match(reviewAction, /body\.length > REVIEW_TEXT_LIMITS\.bodyMax/);
  assert.match(
    readSource("src/components/admin/AdminGlobalSearchResultsView.tsx"),
    /maxLength=\{ADMIN_SEARCH_QUERY_MAX_LENGTH\}/,
  );
  assert.match(
    readSource("src/components/admin/AdminMemberSignupApprovalDetail.tsx"),
    /maxLength=\{MM_SIGNUP_DISPLAY_NAME_MAX_LENGTH\}/,
  );
});

test("수료증 문서 번호 상한은 승인 입력과 서버 검증이 같은 상수를 쓴다", async () => {
  const { GRADUATE_DOCUMENT_NUMBER_MAX_LENGTH, validateGraduateDocumentNumber } = await import(
    "@/lib/graduate-verification"
  );

  assert.equal(GRADUATE_DOCUMENT_NUMBER_MAX_LENGTH, 160);
  assert.equal(validateGraduateDocumentNumber("A".repeat(160)), "A".repeat(160));
  assert.equal(validateGraduateDocumentNumber("A".repeat(161)), null);
  assert.equal(validateGraduateDocumentNumber("AB"), null);
  assert.equal(validateGraduateDocumentNumber("ssafy-15-2026-0001"), "SSAFY1520260001");
  assert.match(
    readSource("src/components/admin/AdminGraduateVerificationQueue.tsx"),
    /maxLength=\{GRADUATE_DOCUMENT_NUMBER_MAX_LENGTH\}/,
  );
});

test("수료생 인증 이름·인증 코드·제휴 신청 검색어 상한은 화면과 서버가 같은 상수를 쓴다", async () => {
  const { GRADUATE_LEGAL_NAME_MAX_LENGTH, validateGraduateEducationDetails } = await import(
    "@/lib/graduate-verification"
  );
  const { PARTNER_REGISTRATION_QUEUE_SEARCH_MAX_LENGTH } = await import("@/lib/partner-registration");
  const { SIX_DIGIT_CODE_LENGTH } = await import("@/lib/validation");

  assert.equal(GRADUATE_LEGAL_NAME_MAX_LENGTH, 100);
  assert.equal(PARTNER_REGISTRATION_QUEUE_SEARCH_MAX_LENGTH, 100);
  assert.equal(SIX_DIGIT_CODE_LENGTH, 6);

  const now = new Date("2026-10-05T06:00:00.000Z");
  const details = { generation: 1, campus: "서울" };
  assert.equal(
    validateGraduateEducationDetails({ ...details, legalName: ` ${"가".repeat(100)} ` }, now).ok,
    true,
  );
  const tooLong = validateGraduateEducationDetails({ ...details, legalName: "가".repeat(101) }, now);
  assert.equal(tooLong.ok ? null : tooLong.fieldErrors.legalName, "이름은 1~100자로 입력해 주세요.");

  const application = readSource("src/components/graduate-verification/GraduateVerificationApplicationView.tsx");
  assert.match(application, /maxLength=\{GRADUATE_LEGAL_NAME_MAX_LENGTH\}/);
  assert.match(application, /maxLength=\{SIX_DIGIT_CODE_LENGTH\}/);
  assert.match(
    readSource("src/components/admin/AdminPartnerRegistrationsView.tsx"),
    /maxLength=\{PARTNER_REGISTRATION_QUEUE_SEARCH_MAX_LENGTH\}/,
  );
  assert.match(
    readSource("src/app/admin/(protected)/partner-registrations/page.tsx"),
    /slice\(0, PARTNER_REGISTRATION_QUEUE_SEARCH_MAX_LENGTH\)/,
  );
});

// 서버에 같은 상한 규칙이 아직 없는 FE 전용 상한. 관리자 알림 작성기의 제목 60자·내용 160자는
// 서버 공용 경로가 자동 발송(신규 제휴·만료 예정·이벤트 당첨)과 템플릿 상한(2000/20000)을 공유하고,
// 기존 알림을 불러와 다시 보내는 흐름이 있어 서버 거부 규칙을 새로 정하는 결정이 필요하다.
const MAX_LENGTH_LITERAL_EXCEPTIONS = new Map([
  ["components/admin/push-manager/PushComposerSection.tsx", 2],
]);

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.stories\.tsx$/u.test(entry.name) ? [child] : [];
  });
}

test("폼 maxLength는 숫자 리터럴 대신 서버 검증과 공유하는 상수를 참조한다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders: string[] = [];
  for (const file of listSourceFiles(sourceRoot)) {
    const relative = decodeURIComponent(file.href.slice(sourceRoot.href.length));
    const count = readFileSync(file, "utf8").match(/maxLength=(?:\{\s*\d[\d_]*\s*\}|"\d+")/gu)?.length ?? 0;
    if (count > (MAX_LENGTH_LITERAL_EXCEPTIONS.get(relative) ?? 0)) {
      offenders.push(`${relative}: ${count}`);
    }
  }
  assert.deepEqual(offenders, []);
});
