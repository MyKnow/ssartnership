import { createHash, randomBytes } from "node:crypto";
import {
  buildDrawAuditSummary,
  type DrawAuditSummary,
  type DrawSeedSource,
} from "@/lib/draw-audit";
import type {
  EventRewardAdminOverview,
  EventRewardDrawPlan,
  EventRewardDrawPreviewRequest,
  EventRewardDrawRequest,
  EventRewardDrawWinner,
  EventRewardValidationResult,
} from "@/lib/promotions/event-rewards-types";

/**
 * Event pages whose tickets are drawn and notified from the admin console.
 * Every reward action and export must name one of these slugs explicitly; there
 * is no implicit default event.
 */
export const EVENT_REWARD_DRAW_EVENT_SLUGS = ["signup-reward"] as const;

export function supportsEventRewardDraw(slug: string | null | undefined) {
  return EVENT_REWARD_DRAW_EVENT_SLUGS.some((candidate) => candidate === slug);
}

/**
 * Reward failures whose message is written for admins and safe to show as-is.
 * Other errors may carry database text and must be replaced by a fallback.
 */
export class EventRewardSafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventRewardSafeError";
  }
}

export function requireEventRewardSlug(eventSlug: string | null | undefined) {
  const slug = typeof eventSlug === "string" ? eventSlug.trim() : "";
  if (!supportsEventRewardDraw(slug)) {
    throw new EventRewardSafeError("추첨 대상 이벤트를 확인해 주세요.");
  }
  return slug;
}

function hashToIndex(seed: string, round: number, maxExclusive: number) {
  const digest = createHash("sha256")
    .update(`${seed}:${round}`)
    .digest();
  const value = digest.readUInt32BE(0);
  return value % maxExclusive;
}

function normalizeEventRewardWinnerCount(value: unknown) {
  const winnerCount = Number(value);
  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new Error("당첨 인원은 1명 이상이어야 합니다.");
  }
  return winnerCount;
}

function normalizeEventRewardDrawSeed(value: unknown) {
  return String(value ?? "").trim() || randomBytes(16).toString("hex");
}

function eventRewardValidationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function normalizeEventRewardDrawRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
  googleFormUrl?: unknown;
}): EventRewardDrawRequest {
  const winnerCount = normalizeEventRewardWinnerCount(input.winnerCount);

  const rawUrl = String(input.googleFormUrl ?? "").trim();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("구글폼 링크 형식을 확인해 주세요.");
  }
  const host = url.hostname.toLowerCase();
  const googleFormsHost =
    host === "forms.gle" ||
    (host === "docs.google.com" && url.pathname.startsWith("/forms/"));
  if (url.protocol !== "https:" || !googleFormsHost) {
    throw new Error("구글폼 HTTPS 링크만 사용할 수 있습니다.");
  }

  const seed = normalizeEventRewardDrawSeed(input.seed);
  return {
    winnerCount,
    seed,
    googleFormUrl: url.toString(),
  };
}

export function parseEventRewardDrawRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
  googleFormUrl?: unknown;
}): EventRewardValidationResult<EventRewardDrawRequest> {
  try {
    return { ok: true, value: normalizeEventRewardDrawRequest(input) };
  } catch (error) {
    return {
      ok: false,
      message: eventRewardValidationErrorMessage(
        error,
        "추첨 확정 입력값을 확인해 주세요.",
      ),
    };
  }
}

export function normalizeEventRewardDrawPreviewRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
}): EventRewardDrawPreviewRequest {
  return {
    winnerCount: normalizeEventRewardWinnerCount(input.winnerCount),
    seed: normalizeEventRewardDrawSeed(input.seed),
  };
}

export function parseEventRewardDrawPreviewRequest(input: {
  winnerCount?: unknown;
  seed?: unknown;
}): EventRewardValidationResult<EventRewardDrawPreviewRequest> {
  try {
    return { ok: true, value: normalizeEventRewardDrawPreviewRequest(input) };
  } catch (error) {
    return {
      ok: false,
      message: eventRewardValidationErrorMessage(
        error,
        "테스트 추첨 입력값을 확인해 주세요.",
      ),
    };
  }
}

export function createEventRewardDrawPlan(
  overview: EventRewardAdminOverview,
  input: {
    winnerCount: number;
    seed?: string | null;
  },
): EventRewardDrawPlan {
  const seed = input.seed?.trim() || randomBytes(16).toString("hex");
  const candidates = overview.members
    .filter((member) => member.totalTickets > 0)
    .map((member) => ({ ...member }));

  if (candidates.length === 0) {
    throw new EventRewardSafeError("추첨 가능한 후보가 없습니다.");
  }
  if (!Number.isInteger(input.winnerCount) || input.winnerCount <= 0) {
    throw new EventRewardSafeError("당첨 인원은 1명 이상이어야 합니다.");
  }
  if (input.winnerCount > candidates.length) {
    throw new EventRewardSafeError("당첨 인원은 추첨 가능한 후보 수를 초과할 수 없습니다.");
  }

  const totalTickets = candidates.reduce((sum, member) => sum + member.totalTickets, 0);
  const remaining = [...candidates];
  const winners: EventRewardDrawWinner[] = [];

  for (let round = 0; round < input.winnerCount; round += 1) {
    const remainingTickets = remaining.reduce((sum, member) => sum + member.totalTickets, 0);
    const pickedTicketIndex = hashToIndex(seed, round, remainingTickets);
    let cursor = 0;
    const pickedIndex = remaining.findIndex((member) => {
      cursor += member.totalTickets;
      return pickedTicketIndex < cursor;
    });
    const [winner] = remaining.splice(Math.max(0, pickedIndex), 1);
    if (!winner) {
      throw new Error("추첨 결과를 계산하지 못했습니다.");
    }
    winners.push({
      rank: round + 1,
      memberId: winner.id,
      displayName: winner.displayName,
      mmUsername: winner.mmUsername,
      year: winner.year,
      campus: winner.campus,
      ticketCount: winner.totalTickets,
    });
  }

  return {
    seed,
    winnerCount: input.winnerCount,
    candidateCount: candidates.length,
    totalTickets,
    winners,
  };
}

export const EVENT_REWARD_DRAW_ALGORITHM = "sha256-seeded-weighted-v1";

/**
 * Audit summary shared with the showcase draw (see draw-audit). The candidate
 * snapshot follows createEventRewardDrawPlan's candidate order, so the stored
 * seed plus this digest are enough to verify a reproduced draw.
 */
export function buildEventRewardDrawAudit(
  overview: EventRewardAdminOverview,
  seedSource: Extract<DrawSeedSource, "admin" | "generated">,
): DrawAuditSummary {
  return buildDrawAuditSummary({
    algorithm: EVENT_REWARD_DRAW_ALGORITHM,
    seedSource,
    entries: overview.members
      .filter((member) => member.totalTickets > 0)
      .map((member) => ({ id: member.id, weight: member.totalTickets })),
  });
}

export function canViewEventRewardWinnerForm(params: {
  memberId?: string | null;
  winnerMemberIds: readonly string[];
}) {
  return Boolean(
    params.memberId && params.winnerMemberIds.includes(params.memberId),
  );
}

export function getEventRewardWinnerGuidePath(eventSlug: string) {
  return `/events/${eventSlug}/winner-form`;
}
