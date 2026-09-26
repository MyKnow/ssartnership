import type { ShowcasePhase, ShowcaseProjectStatus, ShowcaseProjectType } from "./types";

export const SHOWCASE_PHASE_LABELS: Record<ShowcasePhase, string> = {
  setup: "일정 준비 중",
  paused: "잠시 중단됐어요",
  upcoming: "곧 시작해요",
  submission: "프로젝트 모집 중",
  reviewing: "출품 확인 중",
  experience: "체험·피드백 진행 중",
  verification: "추첨 준비 중",
  announcement: "결과 발표",
  closed: "이벤트 종료",
};

export const SHOWCASE_ADMIN_PHASE_LABELS: Record<ShowcasePhase, string> = {
  setup: "일정 설정 필요",
  paused: "비활성",
  upcoming: "모집 시작 전",
  submission: "모집 진행 중",
  reviewing: "모집 종료 · 체험 시작 전",
  experience: "체험 진행 중",
  verification: "검증·추첨 기간",
  announcement: "결과 발표 중",
  closed: "종료",
};

export const SHOWCASE_TYPE_LABELS: Record<ShowcaseProjectType, string> = {
  web: "Web",
  app: "App",
  game: "Game",
  embedded: "Embedded",
};

export const SHOWCASE_TYPE_NOTES: Record<ShowcaseProjectType, string> = {
  web: "웹 서비스",
  app: "앱 스토어",
  game: "웹·스토어 게임",
  embedded: "시연 영상",
};

/** Owner-facing wording. */
export const SHOWCASE_OWNER_STATUS_LABELS: Record<ShowcaseProjectStatus, string> = {
  pending: "확인 대기",
  approved: "출품 확정",
  changes_requested: "수정 요청",
  rejected: "출품 불가",
  hidden: "비공개 처리",
  withdrawn: "출품 취소",
};

export const SHOWCASE_ADMIN_STATUS_LABELS: Record<ShowcaseProjectStatus, string> = {
  pending: "검토 대기",
  approved: "승인",
  changes_requested: "수정 요청",
  rejected: "반려",
  hidden: "숨김",
  withdrawn: "취소",
};

/** Prize items from the approved plan; winner counts come from the event settings. */
export const SHOWCASE_PRIZES = {
  submitter: { title: "출품 경품", prize: "배달의민족 상품권 1만 원", unit: "개 프로젝트" },
  experiencer: { title: "체험 경품", prize: "메가커피 아이스 아메리카노 교환권", unit: "명" },
} as const;
