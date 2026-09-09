import { isValidEmail } from "@/lib/validation";
import { CAMPUS_DIRECTORY } from "@/lib/campuses";

export const GRADUATE_COHORT_RULE_VERSION = "ssafy-half-year-v1" as const;

/**
 * A certificate can either provision a new graduate account or restore email
 * access to an already-existing member.  Keep this explicit all the way from
 * the email challenge to approval so the recovery path can never fall through
 * to member creation.
 */
export const GRADUATE_VERIFICATION_REQUEST_KINDS = [
  "graduate_signup",
  "existing_member_recovery",
] as const;

export type GraduateVerificationRequestKind =
  (typeof GRADUATE_VERIFICATION_REQUEST_KINDS)[number];

export function parseGraduateVerificationRequestKind(
  value: unknown,
): GraduateVerificationRequestKind | null {
  return typeof value === "string" &&
    GRADUATE_VERIFICATION_REQUEST_KINDS.includes(
      value as GraduateVerificationRequestKind,
    )
    ? (value as GraduateVerificationRequestKind)
    : null;
}

export const GRADUATE_VERIFICATION_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "needs_resubmission",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type GraduateVerificationStatus =
  (typeof GRADUATE_VERIFICATION_STATUSES)[number];

export const MEMBER_PROFILE_IMAGE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "superseded",
] as const;

export type MemberProfileImageStatus =
  (typeof MEMBER_PROFILE_IMAGE_STATUSES)[number];

export const GRADUATE_RESUBMISSION_TARGETS = [
  "education_period",
  "certificate",
  "profile_image",
] as const;

export type GraduateResubmissionTarget =
  (typeof GRADUATE_RESUBMISSION_TARGETS)[number];

export const MAX_GRADUATE_CERTIFICATE_BYTES = 10 * 1024 * 1024;
export const MAX_GRADUATE_CERTIFICATE_PAGES = 5;
export const MAX_GRADUATE_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_GRADUATE_PROFILE_IMAGE_PIXELS = 25_000_000;
export const MIN_GRADUATE_PROFILE_IMAGE_DIMENSION = 320;
export const GRADUATE_PROFILE_IMAGE_SIZE = 640;
export const GRADUATE_CAMPUS_OPTIONS = CAMPUS_DIRECTORY.map(
  (campus) => campus.label,
);

export type GraduateCampus = (typeof GRADUATE_CAMPUS_OPTIONS)[number];

const ALLOWED_PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_PROFILE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const TRANSITIONS: Record<GraduateVerificationStatus, readonly GraduateVerificationStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["in_review", "withdrawn"],
  in_review: ["needs_resubmission", "approved", "rejected"],
  needs_resubmission: ["submitted", "withdrawn"],
  approved: [],
  rejected: [],
  withdrawn: [],
};

const RESUBMISSION_TARGET_SET = new Set<string>(GRADUATE_RESUBMISSION_TARGETS);
const GRADUATE_CAMPUS_SET = new Set<string>(GRADUATE_CAMPUS_OPTIONS);

/** Returns selectable SSAFY generations, newest first. */
export function getGraduateGenerationOptions(now = new Date()) {
  if (now.getFullYear() === 2018 && now.getMonth() === 11) return [1];
  const currentGeneration = Math.min(
    99,
    Math.max(
      0,
      (now.getFullYear() - 2019) * 2 + (now.getMonth() + 1 >= 7 ? 2 : 1),
    ),
  );
  return Array.from({ length: currentGeneration }, (_, index) => currentGeneration - index);
}

export type GraduateEducationDetails = {
  legalName: string;
  generation: unknown;
  campus?: unknown;
};

export type GraduateEducationFieldErrors = Partial<Record<"legalName" | "generation" | "campus", string>>;

export function validateGraduateEducationDetails(
  input: GraduateEducationDetails,
  now = new Date(),
): { ok: true; value: { legalName: string; generation: number; campus: GraduateCampus } } | { ok: false; fieldErrors: GraduateEducationFieldErrors; message: string } {
  const legalName = input.legalName.trim();
  const generation = input.generation;
  const campus = typeof input.campus === "string" ? input.campus.trim() : "";
  const validGenerations = new Set(getGraduateGenerationOptions(now));
  const fieldErrors: GraduateEducationFieldErrors = {};
  if (legalName.length < 1 || legalName.length > 100) fieldErrors.legalName = "이름은 1~100자로 입력해 주세요.";
  if (typeof generation !== "number" || !Number.isInteger(generation) || !validGenerations.has(generation)) fieldErrors.generation = "기수를 선택해 주세요.";
  if (!GRADUATE_CAMPUS_SET.has(campus)) fieldErrors.campus = "캠퍼스를 선택해 주세요.";
  const message = fieldErrors.legalName ?? fieldErrors.generation ?? fieldErrors.campus;
  if (message) return { ok: false, fieldErrors, message };
  return { ok: true, value: { legalName, generation: generation as number, campus: campus as GraduateCampus } };
}

export function normalizeGraduateEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeGraduateDocumentNumber(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

export function validateGraduateDocumentNumber(value: string) {
  const normalized = normalizeGraduateDocumentNumber(value);
  if (!/^[\p{L}\p{N}._/]{3,160}$/u.test(normalized)) {
    return null;
  }
  return normalized;
}

export type GraduateVerificationSubmission = {
  email: string;
  emailNormalized: string;
  legalName: string;
  inferredGeneration: number;
  cohortRuleVersion: typeof GRADUATE_COHORT_RULE_VERSION;
  campus: GraduateCampus;
};

type GraduateSubmissionInput = {
  email: string;
  legalName: string;
  generation: unknown;
  campus?: unknown;
};

export function createGraduateVerificationSubmission(
  input: GraduateSubmissionInput,
):
  | { ok: true; value: GraduateVerificationSubmission }
  | { ok: false; error: string } {
  const emailNormalized = normalizeGraduateEmail(input.email);
  if (!isValidEmail(emailNormalized)) {
    return { ok: false, error: "이메일 주소를 확인해 주세요." };
  }

  const details = validateGraduateEducationDetails(input);
  if (!details.ok) return { ok: false, error: details.message };
  return {
    ok: true,
    value: {
      email: input.email.trim(),
      emailNormalized,
      legalName: details.value.legalName,
      inferredGeneration: details.value.generation,
      cohortRuleVersion: GRADUATE_COHORT_RULE_VERSION,
      campus: details.value.campus,
    },
  };
}


export function canTransitionGraduateVerification(
  from: GraduateVerificationStatus,
  to: GraduateVerificationStatus,
) {
  return TRANSITIONS[from].includes(to);
}

export function getGraduateResubmissionTargets(
  values: readonly string[],
): GraduateResubmissionTarget[] {
  const unique = [...new Set(values)];
  if (
    unique.length === 0 ||
    unique.some((value) => !RESUBMISSION_TARGET_SET.has(value))
  ) {
    throw new Error("보완 항목을 확인해 주세요.");
  }
  return unique as GraduateResubmissionTarget[];
}

export function getGraduateSubmissionFileRequirements(
  resubmissionTargets: readonly GraduateResubmissionTarget[] | null,
) {
  if (!resubmissionTargets) {
    return { certificate: true, profileImage: true } as const;
  }
  return {
    certificate: resubmissionTargets.includes("certificate"),
    profileImage: resubmissionTargets.includes("profile_image"),
  } as const;
}

export function isGraduateVerificationStatus(
  value: unknown,
): value is GraduateVerificationStatus {
  return typeof value === "string" && (GRADUATE_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function getFilenameExtension(value: string) {
  const normalized = value.trim().toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index + 1) : "";
}

export function validateGraduateCertificateUpload(input: {
  name: string;
  type: string;
  size: number;
  pageCount: number;
  hasPdfMagicBytes: boolean;
  isEncrypted: boolean;
  hasJavaScript: boolean;
  hasAttachments: boolean;
}) {
  if (getFilenameExtension(input.name) !== "pdf" || input.type !== "application/pdf") {
    return "교육이수증은 PDF 파일만 업로드할 수 있습니다.";
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_GRADUATE_CERTIFICATE_BYTES) {
    return "교육이수증은 10MB 이하만 업로드할 수 있습니다.";
  }
  if (!input.hasPdfMagicBytes) {
    return "올바른 PDF 파일인지 확인해 주세요.";
  }
  if (!Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > MAX_GRADUATE_CERTIFICATE_PAGES) {
    return "교육이수증은 5페이지 이하의 PDF만 업로드할 수 있습니다.";
  }
  if (input.isEncrypted) {
    return "암호화된 PDF는 업로드할 수 없습니다.";
  }
  if (input.hasJavaScript || input.hasAttachments) {
    return "보안 기능이 포함된 PDF는 업로드할 수 없습니다.";
  }
  return null;
}

export function validateGraduatePhotoUpload(input: {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  isAnimated: boolean;
}) {
  if (
    !ALLOWED_PROFILE_IMAGE_TYPES.has(input.type) ||
    !ALLOWED_PROFILE_IMAGE_EXTENSIONS.has(getFilenameExtension(input.name))
  ) {
    return "본인 사진은 JPEG, PNG, WebP 파일만 업로드할 수 있습니다.";
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    return "본인 사진은 5MB 이하만 업로드할 수 있습니다.";
  }
  if (
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    input.width < MIN_GRADUATE_PROFILE_IMAGE_DIMENSION ||
    input.height < MIN_GRADUATE_PROFILE_IMAGE_DIMENSION
  ) {
    return "본인 사진은 가로와 세로가 각각 320px 이상이어야 합니다.";
  }
  if (input.width !== input.height) {
    return "본인 사진은 1:1 비율로 잘라서 업로드해 주세요.";
  }
  if (input.isAnimated) {
    return "움직이는 이미지는 본인 사진으로 사용할 수 없습니다.";
  }
  return null;
}
