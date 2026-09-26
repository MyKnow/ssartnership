export const SHOWCASE_ERROR_CODES = [
  "submission_closed",
  "project_not_found",
  "project_not_editable",
  "owner_name_unavailable",
  "image_unavailable",
  "experience_closed",
  "registration_required",
  "registration_exists",
  "registration_invalid",
  "own_project",
  "experience_not_started",
  "feedback_too_early",
  "feedback_exists",
  "feedback_invalid",
  "feedback_not_found",
  "draw_closed",
  "draw_order_invalid",
  "draw_exists",
  "draw_invalid",
  "redraw_invalid",
  "winner_ineligible",
  "winner_duplicate",
  "winner_not_found",
  "void_invalid",
  "exclusion_invalid",
  "exclusion_exists",
  "exclusion_not_found",
  "settlement_invalid",
  "unknown",
] as const;

export type ShowcaseErrorCode = (typeof SHOWCASE_ERROR_CODES)[number];

export const SHOWCASE_ERROR_MESSAGES: Record<ShowcaseErrorCode, { message: string; field: string | null }> = {
  submission_closed: { message: "지금은 프로젝트 출품 기간이 아니에요.", field: null },
  project_not_found: { message: "프로젝트를 찾을 수 없어요.", field: null },
  project_not_editable: { message: "지금은 이 프로젝트를 수정하거나 취소할 수 없어요.", field: null },
  owner_name_unavailable: { message: "회원 정보를 확인하지 못했어요. 다시 로그인해 주세요.", field: null },
  image_unavailable: { message: "대표 이미지를 저장하지 못했어요. 이미지를 다시 선택해 주세요.", field: "imageUploadId" },
  experience_closed: { message: "지금은 체험 기간이 아니에요.", field: null },
  registration_required: { message: "체험 전에 참여 등록을 먼저 해 주세요.", field: null },
  registration_exists: { message: "이미 참여 등록을 마쳤어요.", field: null },
  registration_invalid: { message: "회원 정보를 확인한 뒤 다시 참여 등록해 주세요.", field: null },
  own_project: { message: "내 프로젝트는 체험하거나 관심 표시할 수 없어요.", field: null },
  experience_not_started: { message: "체험 시작을 먼저 눌러 주세요.", field: null },
  feedback_too_early: { message: "체험을 시작하고 1분이 지나야 피드백을 남길 수 있어요.", field: "body" },
  feedback_exists: { message: "이 프로젝트에는 이미 피드백을 남겼어요.", field: null },
  feedback_invalid: { message: "피드백은 10자 이상 300자 이하로 남겨 주세요.", field: "body" },
  feedback_not_found: { message: "피드백을 찾을 수 없어요.", field: null },
  draw_closed: { message: "체험이 끝난 뒤, 정산 전까지만 추첨과 검증을 할 수 있어요.", field: null },
  draw_order_invalid: { message: "출품 추첨을 먼저 실행해 주세요.", field: null },
  draw_exists: { message: "이미 추첨을 실행한 분야예요.", field: null },
  draw_invalid: { message: "추첨 요청을 처리할 수 없어요. 경품 수량을 확인해 주세요.", field: null },
  redraw_invalid: { message: "무효 처리한 당첨만 한 번 재추첨할 수 있어요.", field: null },
  winner_ineligible: { message: "추첨 대상 조건이 바뀌었어요. 화면을 새로고침한 뒤 다시 시도해 주세요.", field: null },
  winner_duplicate: { message: "이미 경품을 받은 사람이 포함됐어요. 다시 시도해 주세요.", field: null },
  winner_not_found: { message: "당첨 기록을 찾을 수 없어요.", field: null },
  void_invalid: { message: "무효 사유를 선택해 주세요.", field: "reason" },
  exclusion_invalid: { message: "제외 사유를 2자 이상 500자 이하로 입력해 주세요.", field: "reason" },
  exclusion_exists: { message: "이미 제외한 후보예요.", field: null },
  exclusion_not_found: { message: "제외 기록을 찾을 수 없어요.", field: null },
  settlement_invalid: { message: "결과 발표가 시작된 뒤 한 번만 정산 완료로 기록할 수 있어요.", field: null },
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

/** Maps a raised DB exception text (e.g. `showcase_submission_closed`) to a domain code. */
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
