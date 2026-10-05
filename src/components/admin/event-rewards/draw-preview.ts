import {
  createEventRewardDrawPlan,
  EventRewardSafeError,
  parseEventRewardDrawPreviewRequest,
  type EventRewardAdminOverview,
  type EventRewardDrawPlan,
} from "@/lib/promotions/event-rewards";

export function getEventRewardDrawPreview(params: {
  overview: EventRewardAdminOverview;
  winnerCount?: string;
  seed?: string;
}): { plan: EventRewardDrawPlan | null; error: string | null } {
  if (!params.winnerCount && !params.seed) {
    return { plan: null, error: null };
  }
  if (!params.seed?.trim()) {
    return { plan: null, error: "테스트 추첨 Seed를 확인해 주세요." };
  }
  const request = parseEventRewardDrawPreviewRequest({
    winnerCount: params.winnerCount,
    seed: params.seed,
  });
  if (!request.ok) {
    return {
      plan: null,
      error: request.message,
    };
  }
  // The preview inputs come from the URL, so a winner count above the current
  // candidate count must become an inline message instead of a render error.
  try {
    return {
      plan: createEventRewardDrawPlan(params.overview, {
        winnerCount: request.value.winnerCount,
        seed: request.value.seed,
      }),
      error: null,
    };
  } catch (error) {
    return {
      plan: null,
      error:
        error instanceof EventRewardSafeError
          ? error.message
          : "테스트 추첨을 계산하지 못했습니다. 입력값을 확인해 주세요.",
    };
  }
}
