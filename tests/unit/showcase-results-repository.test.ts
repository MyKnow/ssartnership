import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseEvent } from "@/lib/project-showcase/types";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({ from: mocks.from }) }));
import { SupabaseProjectShowcaseRepository } from "@/lib/project-showcase/repository.supabase";

function query(data: unknown) {
  const result = { data, error: null };
  const builder = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const event: ShowcaseEvent = {
  id: "synthetic-event", slug: "project-showcase", title: "테스트", description: "테스트",
  heroImageSrc: "/ads/project-showcase-banner.png", submissionStartAt: null, submissionEndAt: null,
  experienceStartAt: null, experienceEndAt: "2026-10-08T03:30:00Z", announcementStartAt: "2026-10-08T07:00:00Z",
  announcementEndAt: null, submitterSelectionCount: 19, experiencerSelectionCount: 12, isActive: false,
};
afterEach(() => { vi.restoreAllMocks(); mocks.from.mockReset(); vi.useRealTimers(); });

describe("종료 후 Supabase 개인 조회 경계", () => {
  it("비활성 결과도 본인 회원·이벤트·유효 상태로 범위를 제한한다", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    const repository = new SupabaseProjectShowcaseRepository();
    vi.spyOn(repository, "getEvent").mockResolvedValue(event);
    const winners = query([{ candidate_group: "submitter", project_title: "본인 작품", delivered_at: null }]);
    mocks.from.mockReturnValue(winners);
    expect(await repository.getMemberWinnings("signed-member")).toEqual([{ candidateGroup: "submitter", projectTitle: "본인 작품", deliveredAt: null }]);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("showcase_winners");
    expect(winners.select).toHaveBeenCalledWith("candidate_group,project_title,delivered_at");
    expect(winners.eq.mock.calls).toEqual([["event_id", event.id], ["member_id", "signed-member"], ["status", "active"]]);
    mocks.from.mockClear();
    expect(await repository.getMemberWinnings("")).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-08T06:59:59Z"));
    expect(await repository.getMemberWinnings("signed-member")).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("소유 확인을 통과한 리뷰만 읽고 숨김·작성자 식별 정보를 제외한다", async () => {
    const repository = new SupabaseProjectShowcaseRepository();
    const ownership = query({ id: "own-project" });
    const feedback = query([{ id: "review", body: "표시할 리뷰" }]);
    mocks.from.mockReturnValueOnce(ownership).mockReturnValueOnce(feedback);
    expect(await repository.listOwnerFeedback("signed-member", "own-project")).toEqual([{ id: "review", body: "표시할 리뷰" }]);
    expect(ownership.eq.mock.calls).toEqual([["id", "own-project"], ["owner_member_id", "signed-member"]]);
    expect(feedback.select).toHaveBeenCalledWith("id,body");
    expect(feedback.is).toHaveBeenCalledWith("hidden_at", null);
    expect(feedback.eq).toHaveBeenCalledWith("project_id", "own-project");
    mocks.from.mockReset().mockReturnValueOnce(query(null));
    expect(await repository.listOwnerFeedback("signed-member", "other-project")).toEqual([]);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("showcase_projects");
  });
});
