import { z } from "zod";
import {
  SHOWCASE_PROJECT_TYPES,
  type ShowcaseProjectSubmission,
  type ShowcaseProjectType,
} from "./types";

export const SHOWCASE_MAX_TEAMMATES = 19;
export const SHOWCASE_STUDENT_NUMBER_PATTERN = /^\d{7}$/u;
export const SHOWCASE_STUDENT_NUMBER_MESSAGE = "학번은 숫자 7자리로 입력해 주세요.";

const ALLOWED_DEMO_VIDEO_HOSTS = new Set(["youtube.com", "youtu.be", "m.youtube.com", "vimeo.com", "player.vimeo.com"]);

export const showcaseStudentNumberSchema = z.string().trim()
  .regex(SHOWCASE_STUDENT_NUMBER_PATTERN, SHOWCASE_STUDENT_NUMBER_MESSAGE);

const httpsUrlSchema = z.string().trim().min(1, "체험 주소를 입력해 주세요.").max(2048).refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "https로 시작하는 주소를 입력해 주세요.");

const teammateSchema = z.object({
  name: z.string().trim().min(1, "팀원 이름을 입력해 주세요.").max(80, "팀원 이름은 80자 이하로 입력해 주세요."),
  studentNumber: showcaseStudentNumberSchema,
});

export function isSupportedDemoVideoUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    return url.protocol === "https:" && ALLOWED_DEMO_VIDEO_HOSTS.has(host);
  } catch {
    return false;
  }
}

export const showcaseProjectSubmissionSchema = z.object({
  projectType: z.enum(SHOWCASE_PROJECT_TYPES, "프로젝트 유형을 선택해 주세요."),
  title: z.string().trim().min(2, "서비스 이름을 2자 이상 입력해 주세요.").max(100, "서비스 이름은 100자 이하로 입력해 주세요."),
  teamName: z.string().trim().max(60, "팀명은 60자 이하로 입력해 주세요.").transform((value) => value || null),
  summary: z.string().trim().min(5, "한 줄 소개를 5자 이상 입력해 주세요.").max(240, "한 줄 소개는 240자 이하로 입력해 주세요."),
  description: z.string().trim().min(20, "서비스 설명을 20자 이상 입력해 주세요.").max(8000, "서비스 설명은 8000자 이하로 입력해 주세요."),
  serviceUrl: httpsUrlSchema,
  ownerStudentNumber: showcaseStudentNumberSchema,
  teammates: z.array(teammateSchema).max(SHOWCASE_MAX_TEAMMATES, `팀원은 최대 ${SHOWCASE_MAX_TEAMMATES}명까지 추가할 수 있어요.`),
  imageUploadId: z.string().uuid("대표 이미지를 선택해 주세요.").nullable(),
  participantsConsent: z.literal(true, "팀원에게 이름·학번의 이벤트 운영 사용을 안내하고 동의를 확인해 주세요."),
  announcementConsent: z.literal(true, "당첨 시 이름·학번 일부를 가려 공지하는 데 동의해 주세요."),
}).superRefine((value, context) => {
  if (value.teammates.length > 0 && !value.teamName) {
    context.addIssue({ code: "custom", path: ["teamName"], message: "팀으로 출품하면 팀명을 입력해 주세요." });
  }
  const studentNumbers = [value.ownerStudentNumber, ...value.teammates.map((teammate) => teammate.studentNumber)];
  if (new Set(studentNumbers).size !== studentNumbers.length) {
    context.addIssue({ code: "custom", path: ["teammates"], message: "같은 학번을 두 번 입력할 수 없어요." });
  }
  if (value.projectType === "embedded" && !isSupportedDemoVideoUrl(value.serviceUrl)) {
    context.addIssue({ code: "custom", path: ["serviceUrl"], message: "YouTube 또는 Vimeo 시연 영상 주소를 입력해 주세요." });
  }
});

export type ShowcaseValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; field: string | null; path?: Array<string | number> };

/**
 * Shared by the submission form (before upload) and the server action.
 * `requireImage` is false only when editing a project that already has an image.
 */
export function parseShowcaseProjectSubmission(
  value: unknown,
  options: { requireImage: boolean } = { requireImage: true },
): ShowcaseValidationResult<ShowcaseProjectSubmission> {
  const result = showcaseProjectSubmissionSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = (issue?.path ?? []).filter((part): part is string | number => typeof part !== "symbol");
    const field = typeof path[0] === "string" ? path[0] : null;
    return { success: false, message: issue?.message ?? "입력 내용을 확인해 주세요.", field, path };
  }
  if (options.requireImage && !result.data.imageUploadId) {
    return { success: false, message: "대표 이미지를 선택해 주세요.", field: "imageUploadId" };
  }
  return { success: true, data: result.data as ShowcaseProjectSubmission };
}

const KOREA_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u;

/** Converts a `datetime-local` value entered in Asia/Seoul into an ISO string. */
export function parseKoreaDateTimeLocal(value: string) {
  if (!KOREA_DATETIME_PATTERN.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export const SHOWCASE_SCHEDULE_FIELDS = [
  "submissionStartAt",
  "submissionEndAt",
  "experienceStartAt",
  "experienceEndAt",
  "announcementStartAt",
  "announcementEndAt",
] as const;

export type ShowcaseScheduleSubmission = {
  submissionStartAt: string;
  submissionEndAt: string;
  experienceStartAt: string;
  experienceEndAt: string;
  announcementStartAt: string;
  announcementEndAt: string | null;
  submitterSelectionCount: number;
  experiencerSelectionCount: number;
  isActive: boolean;
};

/** Shared by the admin schedule form and `updateShowcaseSchedule`. Inputs are Asia/Seoul `datetime-local` strings. */
export function parseShowcaseSchedule(input: Record<string, string>): ShowcaseValidationResult<ShowcaseScheduleSubmission> {
  const dates: Partial<Record<(typeof SHOWCASE_SCHEDULE_FIELDS)[number], string | null>> = {};
  for (const field of SHOWCASE_SCHEDULE_FIELDS) {
    const raw = (input[field] ?? "").trim();
    if (!raw) {
      if (field === "announcementEndAt") {
        dates[field] = null;
        continue;
      }
      return { success: false, message: "모든 기간의 시작과 종료를 입력해 주세요.", field };
    }
    const parsed = parseKoreaDateTimeLocal(raw);
    if (!parsed) return { success: false, message: "날짜와 시간을 다시 확인해 주세요.", field };
    dates[field] = parsed;
  }
  const order: Array<[(typeof SHOWCASE_SCHEDULE_FIELDS)[number], (typeof SHOWCASE_SCHEDULE_FIELDS)[number], boolean]> = [
    ["submissionStartAt", "submissionEndAt", true],
    ["submissionEndAt", "experienceStartAt", false],
    ["experienceStartAt", "experienceEndAt", true],
    ["experienceEndAt", "announcementStartAt", false],
    ["announcementStartAt", "announcementEndAt", true],
  ];
  for (const [earlier, later, strict] of order) {
    const start = dates[earlier];
    const end = dates[later];
    if (!start || !end) continue;
    if (strict ? start >= end : start > end) {
      return { success: false, message: "모집 → 체험 → 발표 순서로 기간이 겹치지 않게 입력해 주세요.", field: later };
    }
  }
  const counts: Record<"submitterSelectionCount" | "experiencerSelectionCount", number> = {
    submitterSelectionCount: 0,
    experiencerSelectionCount: 0,
  };
  for (const field of ["submitterSelectionCount", "experiencerSelectionCount"] as const) {
    const value = Number((input[field] ?? "").trim());
    if (!Number.isInteger(value) || value < 0 || value > 500) {
      return { success: false, message: "당첨 수량은 0~500 사이 정수로 입력해 주세요.", field };
    }
    counts[field] = value;
  }
  return {
    success: true,
    data: {
      submissionStartAt: dates.submissionStartAt!,
      submissionEndAt: dates.submissionEndAt!,
      experienceStartAt: dates.experienceStartAt!,
      experienceEndAt: dates.experienceEndAt!,
      announcementStartAt: dates.announcementStartAt!,
      announcementEndAt: dates.announcementEndAt ?? null,
      ...counts,
      isActive: input.isActive === "true",
    },
  };
}

export const SHOWCASE_REVIEW_STATUSES = ["approved", "changes_requested", "rejected", "hidden"] as const;

/** Shared by the admin review form and `reviewShowcaseProject`. */
export function parseShowcaseReview(input: { status: string; reviewNote: string }): ShowcaseValidationResult<{
  status: (typeof SHOWCASE_REVIEW_STATUSES)[number];
  reviewNote: string;
}> {
  const status = SHOWCASE_REVIEW_STATUSES.find((value) => value === input.status);
  if (!status) return { success: false, message: "검수 결과를 다시 선택해 주세요.", field: null };
  const reviewNote = input.reviewNote.trim();
  if (reviewNote.length > 2000) {
    return { success: false, message: "검수 사유는 2000자 이하로 입력해 주세요.", field: "reviewNote" };
  }
  if ((status === "changes_requested" || status === "rejected") && !reviewNote) {
    return { success: false, message: "수정 요청이나 반려는 출품자에게 보여 줄 사유를 입력해 주세요.", field: "reviewNote" };
  }
  return { success: true, data: { status, reviewNote } };
}

export const SHOWCASE_SERVICE_URL_HINTS: Record<ShowcaseProjectType, { label: string; placeholder: string }> = {
  web: { label: "서비스 주소", placeholder: "https://..." },
  app: { label: "스토어 또는 다운로드 안내 주소", placeholder: "https://play.google.com/..." },
  game: { label: "웹 게임 또는 스토어 주소", placeholder: "https://..." },
  embedded: { label: "시연 영상 주소 (YouTube 또는 Vimeo)", placeholder: "https://youtu.be/..." },
};

export const showcaseRegistrationSchema = z.object({
  studentNumber: showcaseStudentNumberSchema,
  studentNumberConsent: z.literal(true, "학번을 이벤트 운영에 사용하는 데 동의해 주세요."),
  announcementConsent: z.literal(true, "당첨 시 이름·학번 일부를 가려 공지하는 데 동의해 주세요."),
});

/** Shared by the experience registration form and `registerShowcaseParticipant`. */
export function parseShowcaseRegistration(value: unknown): ShowcaseValidationResult<{ studentNumber: string }> {
  const result = showcaseRegistrationSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = typeof issue?.path[0] === "string" ? issue.path[0] : null;
    return { success: false, message: issue?.message ?? "입력 내용을 확인해 주세요.", field };
  }
  return { success: true, data: { studentNumber: result.data.studentNumber } };
}

export const SHOWCASE_FEEDBACK_MIN_LENGTH = 10;
export const SHOWCASE_FEEDBACK_MAX_LENGTH = 300;

/** Shared by the feedback form and `submitShowcaseFeedback`. */
export function parseShowcaseFeedback(value: unknown): ShowcaseValidationResult<{ body: string }> {
  const body = typeof value === "string" ? value.trim() : "";
  // Count code points like Postgres char_length so emoji do not diverge between FE and DB.
  const length = Array.from(body).length;
  if (length < SHOWCASE_FEEDBACK_MIN_LENGTH || length > SHOWCASE_FEEDBACK_MAX_LENGTH) {
    return {
      success: false,
      message: `피드백은 ${SHOWCASE_FEEDBACK_MIN_LENGTH}자 이상 ${SHOWCASE_FEEDBACK_MAX_LENGTH}자 이하로 남겨 주세요.`,
      field: "body",
    };
  }
  return { success: true, data: { body } };
}

/** Shared by the candidate exclusion form and `excludeShowcaseCandidate`. */
export function parseShowcaseExclusionReason(value: unknown): ShowcaseValidationResult<{ reason: string }> {
  const reason = typeof value === "string" ? value.trim() : "";
  const length = Array.from(reason).length;
  if (length < 2 || length > 500) {
    return { success: false, message: "제외 사유를 2자 이상 500자 이하로 입력해 주세요.", field: "reason" };
  }
  return { success: true, data: { reason } };
}
