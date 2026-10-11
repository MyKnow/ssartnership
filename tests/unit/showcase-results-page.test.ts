import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  header: vi.fn(), projects: vi.fn(), winnings: vi.fn(), draws: vi.fn(), feedback: vi.fn(),
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/ui/Button", () => ({ default: (props: { href?: string; children: React.ReactNode; disabled?: boolean }) =>
  React.createElement(props.href ? "a" : "button", { href: props.href, disabled: props.disabled }, props.children) }));
vi.mock("@/lib/header-session", () => ({ getHeaderSession: mocks.header }));
vi.mock("@/lib/project-showcase", () => ({ projectShowcaseRepository: {
  listOwnerProjects: mocks.projects, getMemberWinnings: mocks.winnings, getDrawState: mocks.draws, listOwnerFeedback: mocks.feedback,
} }));

import ShowcaseResultsPage from "@/components/project-showcase/ShowcaseResultsPage";

const now = new Date("2026-10-12T12:00:00+09:00");
const owned = { id: "own-project", ownerMemberId: "signed-member", title: "내 테스트 프로젝트" };

describe("종료 후 본인 결과 화면", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
    mocks.header.mockResolvedValue(null);
    mocks.projects.mockResolvedValue([]);
    mocks.winnings.mockResolvedValue([]);
    mocks.draws.mockResolvedValue({ submitterDrawn: true, experiencerDrawn: true });
    mocks.feedback.mockResolvedValue([{ id: "review", body: "내 작품에 남겨진 리뷰" }]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("익명 방문자에게 로그인 복귀 링크만 제공하고 개인 데이터는 조회하지 않는다", async () => {
    const html = renderToStaticMarkup(await ShowcaseResultsPage({ userId: null, now }));
    expect(html).toContain("로그인 후 결과 확인");
    expect(html).toContain("/auth/login?returnTo=%2Fevents%2Fproject-showcase");
    expect(html).not.toContain("forms.gle");
    for (const query of [mocks.projects, mocks.winnings, mocks.draws, mocks.feedback]) expect(query).not.toHaveBeenCalled();
  });

  it("서버 세션의 회원만 조회하고 다른 출품작을 결과 화면에서 제외한다", async () => {
    mocks.projects.mockResolvedValue([owned, { id: "other-project", ownerMemberId: "other-member", title: "다른 회원 작품" }]);
    mocks.winnings.mockResolvedValue([{ candidateGroup: "submitter", projectTitle: owned.title, deliveredAt: null }]);
    const html = renderToStaticMarkup(await ShowcaseResultsPage({ userId: "signed-member", now }));
    expect(mocks.projects).toHaveBeenCalledWith("signed-member");
    expect(mocks.winnings).toHaveBeenCalledWith("signed-member");
    expect(mocks.feedback).toHaveBeenCalledExactlyOnceWith("signed-member", "own-project");
    expect(html).toContain("내 작품에 남겨진 리뷰");
    expect(html).not.toContain("다른 회원 작품");
    expect(html).toContain("https://forms.gle/wx6z6fqeNyQ4B8JWA");
    expect(html).not.toContain("https://forms.gle/PuhroAvV6Apw51C68");
  });

  it("체험 당첨자는 체험 폼만 조회한다", async () => {
    mocks.winnings.mockResolvedValue([{ candidateGroup: "experiencer", projectTitle: null, deliveredAt: null }]);
    const html = renderToStaticMarkup(await ShowcaseResultsPage({ userId: "signed-member", now }));
    expect(html).toContain("스타벅스 아이스 카페 아메리카노 Tall");
    expect(html).toContain("https://forms.gle/PuhroAvV6Apw51C68");
    expect(html).not.toContain("https://forms.gle/wx6z6fqeNyQ4B8JWA");
  });

  it("미당첨과 미추첨을 구분하고 수령 링크를 노출하지 않는다", async () => {
    const html = renderToStaticMarkup(await ShowcaseResultsPage({ userId: "signed-member", now }));
    expect(html).toContain("이번에는 당첨되지 않았어요");
    expect(html).not.toContain("forms.gle");
    mocks.draws.mockResolvedValue({ submitterDrawn: false, experiencerDrawn: false });
    const pending = renderToStaticMarkup(await ShowcaseResultsPage({ userId: "signed-member", now }));
    expect(pending).toContain("당첨 결과를 준비하고 있어요");
    expect(pending).not.toContain("이번에는 당첨되지 않았어요");
  });

  it("마감 정각 이후에도 리뷰·당첨을 보여 주고 수령 링크만 제거한다", async () => {
    mocks.projects.mockResolvedValue([owned]);
    mocks.winnings.mockResolvedValue([{ candidateGroup: "submitter", projectTitle: owned.title, deliveredAt: null }]);
    const html = renderToStaticMarkup(await ShowcaseResultsPage({ userId: "signed-member", now: new Date("2026-10-14T18:00:00+09:00") }));
    expect(html).toContain("내 작품에 남겨진 리뷰");
    expect(html).toContain("출품 경품 당첨");
    expect(html).toContain("수령 폼 접수 마감");
    expect(html).not.toContain("forms.gle");
  });

  it("발송 완료는 수령 폼 대신 완료 상태를 제공한다", async () => {
    mocks.winnings.mockResolvedValue([{ candidateGroup: "submitter", projectTitle: null, deliveredAt: now.toISOString() }]);
    const html = renderToStaticMarkup(await ShowcaseResultsPage({ userId: "signed-member", now }));
    expect(html).toContain("경품 발송을 완료했어요");
    expect(html).not.toContain("forms.gle");
  });
});
