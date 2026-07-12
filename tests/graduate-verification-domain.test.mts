import assert from "node:assert/strict";
import test from "node:test";
import {
  GRADUATE_COHORT_RULE_VERSION,
  canTransitionGraduateVerification,
  createGraduateVerificationSubmission,
  getSsafyCohortFromEducationStart,
  getGraduateResubmissionTargets,
  getGraduateSubmissionFileRequirements,
  normalizeGraduateEmail,
  normalizeGraduateDocumentNumber,
  validateGraduateDocumentNumber,
  validateGraduateEducationPeriod,
  validateGraduatePhotoUpload,
  validateGraduateCertificateUpload,
} from "@/lib/graduate-verification";

test("교육 시작 연·월로 SSAFY 기수를 계산한다", () => {
  assert.equal(GRADUATE_COHORT_RULE_VERSION, "ssafy-half-year-v1");
  assert.equal(getSsafyCohortFromEducationStart(2018, 12), 1);
  assert.equal(getSsafyCohortFromEducationStart(2019, 1), 1);
  assert.equal(getSsafyCohortFromEducationStart(2019, 6), 1);
  assert.equal(getSsafyCohortFromEducationStart(2019, 7), 2);
  assert.equal(getSsafyCohortFromEducationStart(2026, 1), 15);
  assert.equal(getSsafyCohortFromEducationStart(2026, 7), 16);
  assert.equal(getSsafyCohortFromEducationStart(2018, 11), null);
  assert.equal(getSsafyCohortFromEducationStart(2026, 13), null);
});

test("교육 종료 연월은 시작 연월보다 빠를 수 없다", () => {
  assert.equal(
    validateGraduateEducationPeriod({
      startYear: 2026,
      startMonth: 1,
      endYear: 2026,
      endMonth: 6,
    }),
    null,
  );
  assert.match(
    validateGraduateEducationPeriod({
      startYear: 2026,
      startMonth: 7,
      endYear: 2026,
      endMonth: 6,
    }) ?? "",
    /종료/,
  );
});

test("서버는 클라이언트가 보낸 기수가 아니라 교육 시작 연월로 기수를 다시 계산한다", () => {
  const result = createGraduateVerificationSubmission({
    email: " Graduate@Example.com ",
    legalName: "홍길동",
    completionStage: "semester_1",
    educationStartYear: 2026,
    educationStartMonth: 1,
    educationEndYear: 2026,
    educationEndMonth: 6,
    campus: "서울",
    claimedCohort: 999,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.emailNormalized, "graduate@example.com");
    assert.equal(result.value.inferredCohort, 15);
    assert.equal(result.value.cohortRuleVersion, "ssafy-half-year-v1");
  }
  assert.equal(normalizeGraduateEmail(" Graduate@Example.com "), "graduate@example.com");
});

test("수료증 문서 번호는 원문을 저장하지 않을 정규화 값으로 제한한다", () => {
  assert.equal(normalizeGraduateDocumentNumber("  2026 - 45 - 020267  "), "202645020267");
  assert.equal(validateGraduateDocumentNumber("2026 - 45 - 020267"), "202645020267");
  assert.equal(validateGraduateDocumentNumber("--"), null);
});

test("수료생 인증 상태 전이를 제한한다", () => {
  assert.equal(canTransitionGraduateVerification("draft", "submitted"), true);
  assert.equal(canTransitionGraduateVerification("draft", "withdrawn"), true);
  assert.equal(canTransitionGraduateVerification("in_review", "approved"), true);
  assert.equal(canTransitionGraduateVerification("in_review", "needs_resubmission"), true);
  assert.equal(canTransitionGraduateVerification("needs_resubmission", "submitted"), true);
  assert.equal(canTransitionGraduateVerification("needs_resubmission", "withdrawn"), true);
  assert.equal(canTransitionGraduateVerification("approved", "submitted"), false);
  assert.equal(canTransitionGraduateVerification("rejected", "approved"), false);
  assert.equal(canTransitionGraduateVerification("withdrawn", "submitted"), false);
});

test("보완 요청은 수료증·사진·교육기간을 독립적으로 구분한다", () => {
  assert.deepEqual(
    getGraduateResubmissionTargets(["certificate", "certificate", "profile_image"]),
    ["certificate", "profile_image"],
  );
  assert.throws(
    () => getGraduateResubmissionTargets(["certificate", "invalid_target"]),
    /보완 항목/,
  );
  assert.deepEqual(
    getGraduateSubmissionFileRequirements(["profile_image"]),
    { certificate: false, profileImage: true },
  );
  assert.deepEqual(
    getGraduateSubmissionFileRequirements(["education_period"]),
    { certificate: false, profileImage: false },
  );
  assert.deepEqual(
    getGraduateSubmissionFileRequirements(null),
    { certificate: true, profileImage: true },
  );
});

test("수료증은 PDF·10MB·5페이지 이내만 허용한다", () => {
  assert.equal(
    validateGraduateCertificateUpload({
      name: "completion.pdf",
      type: "application/pdf",
      size: 10 * 1024 * 1024,
      pageCount: 5,
      hasPdfMagicBytes: true,
      isEncrypted: false,
      hasJavaScript: false,
      hasAttachments: false,
    }),
    null,
  );
  assert.match(
    validateGraduateCertificateUpload({
      name: "completion.pdf",
      type: "application/pdf",
      size: 1,
      pageCount: 1,
      hasPdfMagicBytes: false,
      isEncrypted: false,
      hasJavaScript: false,
      hasAttachments: false,
    }) ?? "",
    /PDF/,
  );
  assert.match(
    validateGraduateCertificateUpload({
      name: "completion.pdf",
      type: "application/pdf",
      size: 1,
      pageCount: 1,
      hasPdfMagicBytes: true,
      isEncrypted: true,
      hasJavaScript: false,
      hasAttachments: false,
    }) ?? "",
    /암호화/,
  );
});

test("본인 사진은 허용된 1:1 이미지 입력만 허용한다", () => {
  assert.equal(
    validateGraduatePhotoUpload({
      name: "profile.png",
      type: "image/png",
      size: 5 * 1024 * 1024,
      width: 320,
      height: 320,
      isAnimated: false,
    }),
    null,
  );
  assert.match(
    validateGraduatePhotoUpload({
      name: "profile.heic",
      type: "image/heic",
      size: 1,
      width: 320,
      height: 320,
      isAnimated: false,
    }) ?? "",
    /JPEG|PNG|WebP/,
  );
  assert.match(
    validateGraduatePhotoUpload({
      name: "profile.webp",
      type: "image/webp",
      size: 1,
      width: 319,
      height: 319,
      isAnimated: false,
    }) ?? "",
    /320/,
  );
});
