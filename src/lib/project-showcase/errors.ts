export const SHOWCASE_ERROR_CODES = [
  "submission_closed",
  "owner_already_submitted",
  "student_number_taken",
  "project_not_found",
  "project_not_editable",
  "owner_name_unavailable",
  "image_unavailable",
  "unknown",
] as const;

export type ShowcaseErrorCode = (typeof SHOWCASE_ERROR_CODES)[number];

export const SHOWCASE_ERROR_MESSAGES: Record<ShowcaseErrorCode, { message: string; field: string | null }> = {
  submission_closed: { message: "지금은 프로젝트 출품 기간이 아니에요.", field: null },
  owner_already_submitted: { message: "이미 출품한 프로젝트가 있어요. 참가자 1인당 1개만 출품할 수 있어요.", field: null },
  student_number_taken: { message: "다른 프로젝트에 이미 등록된 학번이 있어요. 학번을 다시 확인해 주세요.", field: "teammates" },
  project_not_found: { message: "프로젝트를 찾을 수 없어요.", field: null },
  project_not_editable: { message: "지금은 이 프로젝트를 수정하거나 취소할 수 없어요.", field: null },
  owner_name_unavailable: { message: "회원 정보를 확인하지 못했어요. 다시 로그인해 주세요.", field: null },
  image_unavailable: { message: "대표 이미지를 저장하지 못했어요. 이미지를 다시 선택해 주세요.", field: "imageUploadId" },
  unknown: { message: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", field: null },
};

export class ShowcaseDomainError extends Error {
  readonly code: ShowcaseErrorCode;

  constructor(code: ShowcaseErrorCode) {
    super(SHOWCASE_ERROR_MESSAGES[code].message);
    this.name = "ShowcaseDomainError";
    this.code = code;
  }
}

/** Maps a raised DB exception text (e.g. `showcase_owner_already_submitted`) to a domain code. */
export function showcaseErrorCodeFromDatabase(message: string | null | undefined): ShowcaseErrorCode {
  const match = /showcase_([a-z_]+)/u.exec(message ?? "");
  const code = match?.[1] as ShowcaseErrorCode | undefined;
  return code && SHOWCASE_ERROR_CODES.includes(code) ? code : "unknown";
}

export function toShowcaseFailure(error: unknown) {
  const code = error instanceof ShowcaseDomainError ? error.code : "unknown";
  const { message, field } = SHOWCASE_ERROR_MESSAGES[code];
  return { ok: false as const, code, message, field };
}
