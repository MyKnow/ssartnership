import type { ShowcaseRandomInt } from "./draw";
import type {
  ShowcaseAdminFeedback,
  ShowcaseAdminWinner,
  ShowcaseDrawReceipt,
  ShowcaseDrawState,
  ShowcaseExperiencerCandidate,
  ShowcasePublicWinner,
  ShowcaseSubmitterCandidate,
  ShowcaseVoidReason,
  ShowcaseCandidateGroup,
  ShowcaseEvent,
  ShowcaseMemberParticipation,
  ShowcaseMemberProjectState,
  ShowcaseOwnerFeedback,
  ShowcaseOwnerProject,
  ShowcaseProject,
  ShowcaseProjectStatus,
  ShowcaseProjectSubmission,
  ShowcaseProjectType,
  ShowcaseReviewStatus,
} from "./types";

export type ShowcaseProjectFilters = {
  type?: string;
  query?: string;
  sort?: "newest" | "title";
};

export type ShowcaseEventScheduleInput = Pick<
  ShowcaseEvent,
  | "submissionStartAt"
  | "submissionEndAt"
  | "experienceStartAt"
  | "experienceEndAt"
  | "announcementStartAt"
  | "announcementEndAt"
  | "submitterSelectionCount"
  | "experiencerSelectionCount"
  | "isActive"
>;

export type ShowcaseAdminProject = ShowcaseProject & {
  ownerDisplayName: string;
  reviewNote: string | null;
};

export type ShowcaseAdminMetrics = {
  statusCounts: Record<ShowcaseProjectStatus, number>;
  projectTypeCounts: Record<ShowcaseProjectType, number>;
  totalUniqueViews: number;
  totalExperienceStarts: number;
  totalValidExperiences: number;
  totalInterests: number;
  registeredExperiencers: number;
  completedDraws: number;
  activeWinners: number;
  projectStats: Array<Pick<
    ShowcaseProject,
    "id" | "title" | "projectType" | "viewCount" | "experienceCount" | "validExperienceCount" | "interestCount"
  >>;
};

export const SHOWCASE_ADMIN_ACTIVITY_TYPES = [
  "project_submitted",
  "project_withdrawn",
  "project_viewed",
  "experience_started",
  "feedback_submitted",
  "project_reviewed",
  "event_settings_updated",
  "draw_created",
] as const;
export type ShowcaseAdminActivityType = (typeof SHOWCASE_ADMIN_ACTIVITY_TYPES)[number];

export type ShowcaseAdminActivityDetails = {
  projectType?: ShowcaseProjectType;
  status?: ShowcaseProjectStatus;
  candidateGroup?: ShowcaseCandidateGroup;
  candidateCount?: number;
  selectedCount?: number;
  isActive?: boolean;
};

export type ShowcaseAdminActivityLog = {
  id: string;
  occurredAt: string;
  type: ShowcaseAdminActivityType;
  projectId: string | null;
  projectTitle: string;
  actorType: "member" | "admin";
  details: ShowcaseAdminActivityDetails;
};

export type ShowcaseAdminActivityCursor = {
  occurredAt: string;
  id: string;
};

export type ShowcaseAdminActivityPage = {
  items: ShowcaseAdminActivityLog[];
  nextCursor: ShowcaseAdminActivityCursor | null;
};

export type ShowcaseProjectWriteInput = {
  projectId: string;
  ownerMemberId: string;
  ownerName: string;
  submission: ShowcaseProjectSubmission;
  /** Public URL of a newly attached cover image; null keeps the current image on update. */
  imageUrl: string | null;
};

/**
 * Data access for the project showcase event. Mock and Supabase implementations
 * must enforce the same phase, ownership, multiple-project-per-member and
 * one-prize-per-member rules, raising `ShowcaseDomainError` on violation.
 */
export interface ProjectShowcaseRepository {
  getEvent(): Promise<ShowcaseEvent | null>;
  getMemberDisplayName(memberId: string): Promise<string | null>;

  /** Approved projects, only while the experience phase is open. */
  listPublicProjects(filters?: ShowcaseProjectFilters): Promise<ShowcaseProject[]>;
  /** An approved project, only while the experience phase is open. */
  getPublicProject(id: string): Promise<ShowcaseProject | null>;
  recordUniqueView(projectId: string, memberId: string): Promise<void>;

  /** All of the member's submissions, including withdrawn projects, newest first. */
  listOwnerProjects(memberId: string): Promise<ShowcaseOwnerProject[]>;
  getOwnerProject(memberId: string, projectId: string): Promise<ShowcaseOwnerProject | null>;
  createProject(input: ShowcaseProjectWriteInput & { eventId: string }): Promise<void>;
  updateProject(input: ShowcaseProjectWriteInput): Promise<void>;
  withdrawProject(input: { projectId: string; ownerMemberId: string }): Promise<void>;

  /** Experience phase — each write asserts the phase, approval and ownership rules. */
  registerParticipant(input: { memberId: string }): Promise<void>;
  getMemberProjectState(projectId: string, memberId: string): Promise<ShowcaseMemberProjectState>;
  /** Idempotent: returns the first recorded start time. */
  startExperience(input: { projectId: string; memberId: string }): Promise<{ startedAt: string }>;
  submitFeedback(input: { projectId: string; memberId: string; body: string }): Promise<void>;
  setInterest(input: { projectId: string; memberId: string; interested: boolean }): Promise<void>;
  getMemberParticipation(memberId: string): Promise<ShowcaseMemberParticipation>;
  /** Project ids the member has a valid experience (submitted feedback) for. */
  listMemberCompletedProjectIds(memberId: string): Promise<string[]>;
  /** Visible feedback on the owner's project, without any author data. */
  listOwnerFeedback(memberId: string, projectId: string): Promise<ShowcaseOwnerFeedback[]>;
  listAdminFeedback(input?: { hidden?: boolean }): Promise<ShowcaseAdminFeedback[]>;
  setFeedbackHidden(input: { feedbackId: string; adminId: string; hidden: boolean }): Promise<void>;

  /** Verification, draws and settlement — allowed after the experience ends and before settlement. */
  getDrawState(): Promise<ShowcaseDrawState>;
  listSubmitterCandidates(): Promise<ShowcaseSubmitterCandidate[]>;
  listExperiencerCandidates(): Promise<ShowcaseExperiencerCandidate[]>;
  excludeCandidate(input: {
    group: ShowcaseCandidateGroup;
    projectId?: string;
    memberId?: string;
    reason: string;
    adminId: string;
  }): Promise<void>;
  restoreCandidate(input: { exclusionId: string; adminId: string }): Promise<void>;
  /** Initial draw: submitters uniformly by project, experiencers weighted by tickets. */
  runDraw(input: { group: ShowcaseCandidateGroup; adminId: string; random?: ShowcaseRandomInt }): Promise<ShowcaseDrawReceipt>;
  voidWinner(input: { winnerId: string; adminId: string; reason: ShowcaseVoidReason }): Promise<void>;
  /** Draws one replacement for a voided winner from the same group's remaining pool. */
  redrawWinner(input: { winnerId: string; adminId: string; random?: ShowcaseRandomInt }): Promise<ShowcaseDrawReceipt>;
  setWinnerDelivered(input: { winnerId: string; adminId: string; delivered: boolean }): Promise<void>;
  listAdminWinners(): Promise<ShowcaseAdminWinner[]>;
  /** Active winners, only from the announcement start. */
  listPublicWinners(): Promise<ShowcasePublicWinner[]>;
  /** The member's active prizes, only from the announcement start. */
  getMemberWinnings(memberId: string): Promise<Array<Pick<ShowcasePublicWinner, "candidateGroup" | "projectTitle"> & { deliveredAt: string | null }>>;
  settleEvent(adminId: string): Promise<void>;
  /** Runs the 30-day post-settlement purge when due; returns whether it purged. */
  purgePersonalDataIfDue(): Promise<boolean>;

  getAdminMetrics(): Promise<ShowcaseAdminMetrics | null>;
  listAdminActivity(input: {
    limit: number;
    before?: ShowcaseAdminActivityCursor | null;
    type?: ShowcaseAdminActivityType | null;
  }): Promise<ShowcaseAdminActivityPage>;
  listAdminProjects(status?: ShowcaseProjectStatus): Promise<ShowcaseAdminProject[]>;
  updateEventSchedule(input: ShowcaseEventScheduleInput): Promise<void>;
  reviewProject(input: {
    projectId: string;
    adminId: string;
    status: ShowcaseReviewStatus;
    reviewNote: string;
  }): Promise<void>;
}
