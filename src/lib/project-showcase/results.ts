import type { ShowcaseCandidateGroup, ShowcaseEvent } from "./types";

export const SHOWCASE_CLAIM_DEADLINE_AT = "2026-10-15T11:30:00+09:00";
export const SHOWCASE_CLAIM_DEADLINE_LABEL = "10월 15일(목) 11:30";

const CLAIM_FORMS: Record<ShowcaseCandidateGroup, string> = {
  submitter: "https://forms.gle/wx6z6fqeNyQ4B8JWA",
  experiencer: "https://forms.gle/PuhroAvV6Apw51C68",
};

/** Read-only results remain available after operations stop; writes still use getShowcasePhase. */
export function canReadShowcaseResults(event: ShowcaseEvent | null, now = new Date()): boolean {
  if (!event?.experienceEndAt || !event.announcementStartAt) return false;
  const experienceEnd = Date.parse(event.experienceEndAt);
  const announcementStart = Date.parse(event.announcementStartAt);
  const timestamp = now.getTime();
  return Number.isFinite(experienceEnd) && Number.isFinite(announcementStart)
    && Number.isFinite(timestamp) && timestamp >= experienceEnd && timestamp >= announcementStart;
}

export function getShowcasePrizeClaim(
  group: ShowcaseCandidateGroup,
  deliveredAt: string | null,
  now = new Date(),
): { status: "open"; formUrl: string } | { status: "closed" | "delivered"; formUrl: null } {
  if (deliveredAt) return { status: "delivered", formUrl: null };
  const formUrl = Object.hasOwn(CLAIM_FORMS, group) ? CLAIM_FORMS[group] : null;
  const timestamp = now.getTime();
  if (!formUrl || !Number.isFinite(timestamp) || timestamp >= Date.parse(SHOWCASE_CLAIM_DEADLINE_AT)) {
    return { status: "closed", formUrl: null };
  }
  return { status: "open", formUrl };
}
