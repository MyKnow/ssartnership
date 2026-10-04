import { SHOWCASE_ERROR_MESSAGES } from "./errors";
import {
  SHOWCASE_PROJECT_STATUSES,
  type ShowcaseDrawState,
  type ShowcaseEvent,
  type ShowcaseProjectStatus,
} from "./types";

/**
 * Terminal-state rules shared by the admin forms, server actions and both
 * repositories. The database enforces the same rules in
 * `showcase_guard_project_mutation()`, `showcase_guard_settled_event()` and
 * `settle_showcase_event()`.
 */

/** A withdrawn project never comes back; every other status change is allowed. */
export function canTransitionShowcaseProjectStatus(
  from: ShowcaseProjectStatus,
  to: ShowcaseProjectStatus,
) {
  return from !== "withdrawn" || to === "withdrawn";
}

/** Status options an admin may pick for a project currently in `current`. */
export function getShowcaseAdminStatusOptions(current?: ShowcaseProjectStatus | null) {
  return SHOWCASE_PROJECT_STATUSES.filter(
    (status) => !current || canTransitionShowcaseProjectStatus(current, status),
  );
}

/** Settlement closes schedule, project and review changes for good. */
export function isShowcaseEventSettled(state: Pick<ShowcaseDrawState, "settledAt"> | null | undefined) {
  return Boolean(state?.settledAt);
}

export const SHOWCASE_SETTLED_LOCK_MESSAGE = SHOWCASE_ERROR_MESSAGES.event_settled.message;

export type ShowcaseSettlementBlocker =
  | "settled"
  | "announcement_not_started"
  | "submitter_draw_required"
  | "experiencer_draw_required";

type SettlementEvent = Pick<
  ShowcaseEvent,
  "announcementStartAt" | "submitterSelectionCount" | "experiencerSelectionCount"
>;
type SettlementState = Pick<ShowcaseDrawState, "submitterDrawn" | "experiencerDrawn" | "settledAt">;

function hasAnnouncementStarted(event: SettlementEvent | null, now: number) {
  const start = event?.announcementStartAt ? Date.parse(event.announcementStartAt) : Number.NaN;
  return Number.isFinite(start) && start <= now;
}

/** Why the event cannot be settled yet: once, after the announcement starts, with every prized initial draw done. */
export function getShowcaseSettlementBlocker(
  event: SettlementEvent | null,
  state: SettlementState,
  now = Date.now(),
): ShowcaseSettlementBlocker | null {
  if (state.settledAt) return "settled";
  if (!event || !hasAnnouncementStarted(event, now)) return "announcement_not_started";
  if (event.submitterSelectionCount > 0 && !state.submitterDrawn) return "submitter_draw_required";
  if (event.experiencerSelectionCount > 0 && !state.experiencerDrawn) return "experiencer_draw_required";
  return null;
}

export const SHOWCASE_SETTLEMENT_BLOCKER_MESSAGES: Record<
  Exclude<ShowcaseSettlementBlocker, "settled">,
  string
> = {
  announcement_not_started: "결과 발표가 시작된 뒤 정산할 수 있어요.",
  submitter_draw_required: "출품 추첨을 실행한 뒤 정산할 수 있어요.",
  experiencer_draw_required: "체험 추첨을 실행한 뒤 정산할 수 있어요.",
};

/** The 30-day purge clock starts only at settlement, so warn once the announcement is live without it. */
export function isShowcaseSettlementOverdue(
  event: SettlementEvent | null,
  state: Pick<ShowcaseDrawState, "settledAt">,
  now = Date.now(),
) {
  return !state.settledAt && hasAnnouncementStarted(event, now);
}
