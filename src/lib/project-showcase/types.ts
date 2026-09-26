export const PROJECT_SHOWCASE_SLUG = "project-showcase";

export const SHOWCASE_PROJECT_TYPES = ["web", "app", "game", "embedded"] as const;
export type ShowcaseProjectType = (typeof SHOWCASE_PROJECT_TYPES)[number];

export const SHOWCASE_PROJECT_STATUSES = [
  "pending",
  "approved",
  "changes_requested",
  "rejected",
  "hidden",
  "withdrawn",
] as const;
export type ShowcaseProjectStatus = (typeof SHOWCASE_PROJECT_STATUSES)[number];
export type ShowcaseReviewStatus = Extract<
  ShowcaseProjectStatus,
  "approved" | "changes_requested" | "rejected" | "hidden"
>;

export type ShowcasePhase =
  | "setup"
  | "paused"
  | "upcoming"
  | "submission"
  | "reviewing"
  | "experience"
  | "verification"
  | "announcement"
  | "closed";

export type ShowcaseCandidateGroup = "submitter" | "experiencer";

export type ShowcaseEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImageSrc: string;
  submissionStartAt: string | null;
  submissionEndAt: string | null;
  experienceStartAt: string | null;
  experienceEndAt: string | null;
  announcementStartAt: string | null;
  announcementEndAt: string | null;
  submitterSelectionCount: number;
  experiencerSelectionCount: number;
  isActive: boolean;
};

export type ShowcaseProjectCounts = {
  viewCount: number;
  experienceCount: number;
  validExperienceCount: number;
  interestCount: number;
};

export type ShowcaseProject = ShowcaseProjectCounts & {
  id: string;
  eventId: string;
  projectType: ShowcaseProjectType;
  title: string;
  teamName: string | null;
  summary: string;
  description: string;
  imageUrl: string;
  serviceUrl: string;
  status: ShowcaseProjectStatus;
  ownerMemberId: string;
  createdAt: string;
};

export type ShowcaseOwnerProject = ShowcaseProject & {
  reviewNote: string | null;
  updatedAt: string;
};

export type ShowcaseProjectSubmission = {
  projectType: ShowcaseProjectType;
  title: string;
  teamName: string | null;
  summary: string;
  description: string;
  serviceUrl: string;
  imageUploadId: string | null;
  announcementConsent: true;
};

export function isShowcaseProjectType(value: unknown): value is ShowcaseProjectType {
  return SHOWCASE_PROJECT_TYPES.includes(value as ShowcaseProjectType);
}

export function isShowcaseProjectStatus(value: unknown): value is ShowcaseProjectStatus {
  return SHOWCASE_PROJECT_STATUSES.includes(value as ShowcaseProjectStatus);
}

function toTime(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getShowcasePhase(event: ShowcaseEvent | null, now = new Date()): ShowcasePhase {
  const submissionStart = toTime(event?.submissionStartAt ?? null);
  const submissionEnd = toTime(event?.submissionEndAt ?? null);
  const experienceStart = toTime(event?.experienceStartAt ?? null);
  const experienceEnd = toTime(event?.experienceEndAt ?? null);
  const announcementStart = toTime(event?.announcementStartAt ?? null);
  if (!event || submissionStart === null || submissionEnd === null || experienceStart === null
      || experienceEnd === null || announcementStart === null) {
    return "setup";
  }
  if (!event.isActive) return "paused";

  const announcementEnd = toTime(event.announcementEndAt) ?? Number.POSITIVE_INFINITY;
  const timestamp = now.getTime();
  if (timestamp < submissionStart) return "upcoming";
  if (timestamp < submissionEnd) return "submission";
  if (timestamp < experienceStart) return "reviewing";
  if (timestamp < experienceEnd) return "experience";
  if (timestamp < announcementStart) return "verification";
  if (timestamp < announcementEnd) return "announcement";
  return "closed";
}

export type ShowcaseMilestone = {
  label: string;
  at: string;
};

/** The next scheduled boundary a visitor should know about, if any. */
export function getShowcaseNextMilestone(
  event: ShowcaseEvent | null,
  phase = getShowcasePhase(event),
): ShowcaseMilestone | null {
  if (!event) return null;
  const milestones: Partial<Record<ShowcasePhase, ShowcaseMilestone | null>> = {
    upcoming: event.submissionStartAt ? { label: "출품 시작", at: event.submissionStartAt } : null,
    submission: event.submissionEndAt ? { label: "출품 마감", at: event.submissionEndAt } : null,
    reviewing: event.experienceStartAt ? { label: "체험 시작", at: event.experienceStartAt } : null,
    experience: event.experienceEndAt ? { label: "체험 마감", at: event.experienceEndAt } : null,
    verification: event.announcementStartAt ? { label: "결과 발표", at: event.announcementStartAt } : null,
  };
  return milestones[phase] ?? null;
}

export function maskShowcaseName(name: string) {
  const first = Array.from(name.trim())[0];
  return `${first ?? "참"}**`;
}

export function canOwnerEditShowcaseProject(status: ShowcaseProjectStatus, phase: ShowcasePhase) {
  return phase === "submission" && (status === "pending" || status === "changes_requested");
}

export function canOwnerWithdrawShowcaseProject(status: ShowcaseProjectStatus, phase: ShowcasePhase) {
  return phase === "submission" && status !== "withdrawn";
}

/** Seconds between the experience start and the moment feedback (a valid experience) is accepted. */
export const SHOWCASE_FEEDBACK_UNLOCK_SECONDS = 60;

export type ShowcaseRegistration = {
  registeredAt: string;
};

/** The signed-in member's state on one project's detail page. */
export type ShowcaseMemberProjectState = {
  registered: boolean;
  startedAt: string | null;
  feedbackSubmitted: boolean;
  interested: boolean;
};

export type ShowcaseMemberExperience = {
  projectId: string;
  projectTitle: string;
  startedAt: string;
  feedbackSubmitted: boolean;
};

export type ShowcaseMemberParticipation = {
  registration: ShowcaseRegistration | null;
  experiences: ShowcaseMemberExperience[];
  ticketCount: number;
};

export type ShowcaseOwnerFeedback = {
  id: string;
  body: string;
};

export type ShowcaseAdminFeedback = {
  id: string;
  projectId: string;
  projectTitle: string;
  body: string;
  hidden: boolean;
  createdAt: string;
};

export function getShowcaseFeedbackUnlockAt(startedAt: string) {
  return new Date(new Date(startedAt).getTime() + SHOWCASE_FEEDBACK_UNLOCK_SECONDS * 1000);
}

export function canSubmitShowcaseFeedback(startedAt: string | null, now = new Date()) {
  if (!startedAt) return false;
  const unlockAt = getShowcaseFeedbackUnlockAt(startedAt).getTime();
  return Number.isFinite(unlockAt) && now.getTime() >= unlockAt;
}

/** 추첨권 = 유효 체험(피드백 제출) 프로젝트 수. No base ticket without a valid experience. */
export function countShowcaseTickets(experiences: Array<{ feedbackSubmitted: boolean }>) {
  return experiences.filter((experience) => experience.feedbackSubmitted).length;
}

export const SHOWCASE_VOID_REASONS = ["duplicate", "unreachable", "verification_failed"] as const;
export type ShowcaseVoidReason = (typeof SHOWCASE_VOID_REASONS)[number];

/** Masked winner snapshot that may be shown publicly from the announcement start. */
export type ShowcasePublicWinner = {
  candidateGroup: ShowcaseCandidateGroup;
  position: number;
  maskedName: string;
  projectTitle: string | null;
};

export type ShowcaseAdminWinner = ShowcasePublicWinner & {
  memberId: string | null;
  id: string;
  status: "active" | "voided";
  voidReason: ShowcaseVoidReason | null;
  deliveredAt: string | null;
  replaced: boolean;
};

export type ShowcaseSubmitterCandidate = {
  memberId: string | null;
  projectId: string;
  projectTitle: string;
  ownerDisplayName: string;
  exclusion: { id: string; reason: string } | null;
  alreadyWon: boolean;
};

export type ShowcaseExperiencerCandidate = {
  memberId: string;
  displayName: string;
  tickets: number;
  exclusion: { id: string; reason: string } | null;
  alreadyWon: boolean;
};

export type ShowcaseDrawState = {
  submitterDrawn: boolean;
  experiencerDrawn: boolean;
  settledAt: string | null;
  purgedAt: string | null;
};

export type ShowcaseDrawReceipt = {
  candidateGroup: ShowcaseCandidateGroup;
  candidateCount: number;
  ticketCount: number;
  selectedCount: number;
};
