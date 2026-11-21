import assert from "node:assert/strict";
import test from "node:test";
import {
  GRADUATE_COHORT_RULE_VERSION,
  canTransitionGraduateVerification,
  createGraduateVerificationSubmission,
  getGraduateGenerationOptions,
  getGraduateResubmissionTargets,
  getGraduateSubmissionFileRequirements,
  normalizeGraduateEmail,
  normalizeGraduateDocumentNumber,
  validateGraduateDocumentNumber,
  validateGraduateEducationDetails,
  validateGraduatePhotoUpload,
  validateGraduateCertificateUpload,
} from "@/lib/graduate-verification";

test("현재 SSAFY 기수를 기준으로 선택지를 만든다", () => {
  assert.equal(GRADUATE_COHORT_RULE_VERSION, "ssafy-half-year-v1");
  assert.deepEqual(getGraduateGenerationOptions(new Date("2018-11-01T00:00:00+09:00")), []);
  assert.deepEqual(getGraduateGenerationOptions(new Date("2018-12-01T00:00:00+09:00")), [1]);
  assert.deepEqual(getGraduateGenerationOptions(new Date("2019-01-01T00:00:00+09:00")), [1]);
  assert.deepEqual(getGraduateGenerationOptions(new Date("2026-01-01T00:00:00+09:00")), Array.from({ length: 15 }, (_, index) => 15 - index));
  assert.deepEqual(getGraduateGenerationOptions(new Date("2026-07-01T00:00:00+09:00")), Array.from({ length: 16 }, (_, index) => 16 - index));
});

test("기수 선택지의 반기 경계는 서버·브라우저 시간대가 아니라 서울 날짜로 판단한다", () => {
  // UTC 2026-06-30 15:30 = KST 2026-07-01 00:30 → 16기까지
  const julyInSeoul = new Date("2026-06-30T15:30:00.000Z");
  // UTC 2026-06-30 14:59 = KST 2026-06-30 23:59 → 15기까지
  const juneInSeoul = new Date("2026-06-30T14:59:00.000Z");
  // UTC 2018-11-30 15:00 = KST 2018-12-01 00:00 → 1기 모집 시작
  const firstCohortInSeoul = new Date("2018-11-30T15:00:00.000Z");

  for (const timeZone of ["UTC", "Asia/Seoul", "America/Los_Angeles"]) {
    const previous = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      assert.equal(getGraduateGenerationOptions(julyInSeoul)[0], 16, timeZone);
      assert.equal(getGraduateGenerationOptions(juneInSeoul)[0], 15, timeZone);
      assert.deepEqual(getGraduateGenerationOptions(firstCohortInSeoul), [1], timeZone);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  }
});

test("서버는 선택한 유효 기수를 저장한다", () => {
  const result = createGraduateVerificationSubmission({
    email: " Graduate@Example.com ",
    legalName: "홍길동",
    generation: 15,
    campus: "서울",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.emailNormalized, "graduate@example.com");
    assert.equal(result.value.inferredGeneration, 15);
    assert.equal(result.value.cohortRuleVersion, "ssafy-half-year-v1");
  }
  assert.equal(normalizeGraduateEmail(" Graduate@Example.com "), "graduate@example.com");
});

test("수료생 인증은 지정된 캠퍼스를 반드시 선택해야 한다", () => {
  const baseInput = {
    email: "graduate@example.com",
    legalName: "홍길동",
    generation: 15,
  } as const;

  const missingCampus = createGraduateVerificationSubmission(baseInput);
  assert.equal(missingCampus.ok, false);
  if (!missingCampus.ok) {
    assert.match(missingCampus.error, /캠퍼스/);
  }

  const invalidCampus = createGraduateVerificationSubmission({
    ...baseInput,
    campus: "창업",
  });
  assert.equal(invalidCampus.ok, false);
  if (!invalidCampus.ok) {
    assert.match(invalidCampus.error, /캠퍼스/);
  }
});

test("교육 정보 검증은 미래·비정수 기수와 잘못된 필드를 구분한다", () => {
  const now = new Date("2026-01-01");
  const valid = validateGraduateEducationDetails({ legalName: "홍길동", generation: 15, campus: "서울" }, now);
  assert.equal(valid.ok, true);
  const invalid = validateGraduateEducationDetails({ legalName: "", generation: 16.5, campus: "없음" }, now);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), ["campus", "generation", "legalName"]);
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
