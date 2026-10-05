import {
  createEventRewardDrawPlan,
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
  return {
    plan: createEventRewardDrawPlan(params.overview, {
      winnerCount: request.value.winnerCount,
      seed: request.value.seed,
    }),
    error: null,
  };
}
