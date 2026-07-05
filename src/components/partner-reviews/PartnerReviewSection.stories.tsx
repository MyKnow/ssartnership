"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { buildPartnerReviewSummary, type PartnerReview } from "@/lib/partner-reviews";
import PartnerReviewSection from "./PartnerReviewSection";

const partnerId = "partner-review-prefetch";

function makeReview(index: number): PartnerReview {
  const rating = (index % 5) + 1;
  return {
    id: `review-${index}`,
    partnerId,
    memberId: `member-${index}`,
    rating,
    title: `빠르게 확인한 리뷰 ${index}`,
    body: "제휴 인증과 혜택 적용 흐름이 명확해서 이용 과정에서 기다림이 적었습니다.",
    images: [],
    createdAt: `2026-05-${String(Math.min(index, 28)).padStart(2, "0")}T09:00:00.000Z`,
    updatedAt: `2026-05-${String(Math.min(index, 28)).padStart(2, "0")}T09:00:00.000Z`,
    authorMaskedName: "김**",
    authorRoleLabel: "15기 교육생",
    isMine: false,
    isHidden: false,
    hiddenAt: null,
    recommendCount: index,
    disrecommendCount: 0,
    myReaction: null,
  };
}

const firstPageReviews = Array.from({ length: 10 }, (_, index) => makeReview(index + 1));
const nextPageReviews = [makeReview(11), makeReview(12)];
const allReviewRatings = [...firstPageReviews, ...nextPageReviews].map((review) => review.rating);

type FetchMock = typeof fetch & {
  mock: {
    calls: unknown[][];
  };
};

function mockReviewListFetch() {
  const fetchMock = fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      summary: buildPartnerReviewSummary(allReviewRatings),
      items: nextPageReviews,
      nextOffset: 12,
      hasMore: false,
    }),
  })) as unknown as FetchMock;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function getFetchMock(loaded: unknown) {
  return (loaded as { fetchMock: FetchMock }).fetchMock;
}

const meta = {
  title: "Domains/PartnerReviews/PartnerReviewSection",
  component: PartnerReviewSection,
  args: {
    partnerId,
    canWriteReview: false,
    accessMode: "public",
    showWriteControls: false,
    title: "리뷰",
    description: "다음 페이지 선로딩 상태를 검증합니다.",
    initialSummary: buildPartnerReviewSummary(allReviewRatings),
    initialReviews: firstPageReviews,
    initialSort: "latest",
    initialOffset: 10,
    initialHasMore: true,
  },
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
  },
} satisfies Meta<typeof PartnerReviewSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PrefetchesNextPage: Story = {
  loaders: [
    async () => ({
      fetchMock: mockReviewListFetch(),
    }),
  ],
  play: async ({ canvasElement, loaded }) => {
    const fetchMock = getFetchMock(loaded);
    const canvas = within(canvasElement);

    await expect(canvas.getByText("현재 10개 표시 중입니다.")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const callsBeforeClick = fetchMock.mock.calls.length;
    await expect(fetchMock.mock.calls[0]?.[0]).toEqual(expect.stringContaining("offset=10"));
    await expect(fetchMock.mock.calls[0]?.[1]).toEqual({ cache: "no-store" });

    await userEvent.click(canvas.getByRole("button", { name: "더보기" }));
    await waitFor(() => {
      expect(canvas.getByText("빠르게 확인한 리뷰 12")).toBeInTheDocument();
    });
    await expect(canvas.queryByRole("button", { name: "더보기" })).not.toBeInTheDocument();
    await expect(fetchMock).toHaveBeenCalledTimes(callsBeforeClick);
  },
};

export const LoadMoreFallback: Story = {
  loaders: [
    async () => ({
      fetchMock: mockReviewListFetch(),
    }),
  ],
  play: async ({ canvasElement, loaded }) => {
    const fetchMock = getFetchMock(loaded);
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "더보기" }));
    await waitFor(() => {
      expect(canvas.getByText("빠르게 확인한 리뷰 12")).toBeInTheDocument();
    });
    await expect(fetchMock).toHaveBeenCalled();
  },
};
