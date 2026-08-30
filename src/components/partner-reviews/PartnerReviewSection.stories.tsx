"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type DeferredFetchRequest = {
  url: string;
  init: RequestInit | undefined;
  response: Deferred<Response>;
};

type DeferredFetchHarness = {
  fetchMock: FetchMock;
  requests: DeferredFetchRequest[];
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createJsonResponse(
  data: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

function mockDeferredFetch(): DeferredFetchHarness {
  const requests: DeferredFetchRequest[] = [];
  const fetchMock = fn((input: RequestInfo | URL, init?: RequestInit) => {
    const response = createDeferred<Response>();
    requests.push({ url: String(input), init, response });
    return response.promise;
  }) as unknown as FetchMock;
  globalThis.fetch = fetchMock;
  return { fetchMock, requests };
}

function getDeferredFetchHarness(loaded: unknown) {
  return (loaded as { fetchHarness: DeferredFetchHarness }).fetchHarness;
}

async function waitForRequest(
  harness: DeferredFetchHarness,
  index: number,
) {
  await waitFor(() => {
    expect(harness.requests).toHaveLength(index + 1);
  });
  return harness.requests[index]!;
}

function forceSelectChangeWhileDisabled(
  select: HTMLSelectElement,
  value: string,
) {
  // Real users are serialized by the disabled control. This deliberately
  // dispatches a second change to exercise the request-id guard against
  // non-UI re-entry while the older fetch ignores AbortSignal.
  select.disabled = false;
  fireEvent.change(select, { target: { value } });
  select.disabled = true;
}

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
    const reviewContainer = canvasElement.querySelector<HTMLElement>(
      "[data-partner-review-container]",
    );
    await expect(reviewContainer).not.toBeNull();
    await expect(
      reviewContainer!.querySelector("[data-partner-review-summary]"),
    ).not.toBeNull();
    await expect(
      reviewContainer!.querySelector("[data-partner-review-filters]"),
    ).not.toBeNull();
    await expect(
      reviewContainer!.querySelector("[data-partner-review-list]"),
    ).not.toBeNull();
    await expect(
      reviewContainer!.querySelectorAll("[data-partner-review-divider]"),
    ).toHaveLength(2);
    await expect(
      reviewContainer!.querySelectorAll("[data-partner-review-item-divider]"),
    ).toHaveLength(9);
    await expect(
      reviewContainer!.querySelectorAll("article[data-partner-review-item]"),
    ).toHaveLength(10);
    await expect(canvas.queryByText("목록")).not.toBeInTheDocument();
    await expect(canvas.queryByText("10개 표시")).not.toBeInTheDocument();
    await expect(
      canvas.getByText("사진이 있는 리뷰만 보기"),
    ).toBeInTheDocument();

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

export const LatestRefreshWinsWhenOlderRequestResolvesLast: Story = {
  args: {
    initialHasMore: false,
  },
  loaders: [
    async () => ({
      fetchHarness: mockDeferredFetch(),
    }),
  ],
  play: async ({ canvasElement, loaded }) => {
    const harness = getDeferredFetchHarness(loaded);
    const canvas = within(canvasElement);
    const ratingSelect = canvas.getByLabelText("필터") as HTMLSelectElement;

    await userEvent.selectOptions(ratingSelect, "5");
    const olderRequest = await waitForRequest(harness, 0);
    await expect(ratingSelect).toBeDisabled();

    forceSelectChangeWhileDisabled(ratingSelect, "1");
    const newerRequest = await waitForRequest(harness, 1);
    await expect(olderRequest.init?.signal?.aborted).toBe(true);

    const newestReview = {
      ...makeReview(21),
      rating: 1,
      title: "최신 요청으로 받은 1점 리뷰",
    };
    newerRequest.response.resolve(
      createJsonResponse({
        summary: buildPartnerReviewSummary([newestReview.rating]),
        items: [newestReview],
        nextOffset: 1,
        hasMore: false,
      }),
    );

    await waitFor(() => {
      expect(canvas.getByText(newestReview.title)).toBeInTheDocument();
    });
    await expect(ratingSelect).toHaveValue("1");

    const staleReview = {
      ...makeReview(20),
      rating: 5,
      title: "늦게 도착한 이전 5점 리뷰",
    };
    olderRequest.response.resolve(
      createJsonResponse({
        summary: buildPartnerReviewSummary([staleReview.rating]),
        items: [staleReview],
        nextOffset: 1,
        hasMore: false,
      }),
    );

    await waitFor(() => {
      expect(canvas.queryByText(staleReview.title)).not.toBeInTheDocument();
      expect(canvas.getByText(newestReview.title)).toBeInTheDocument();
      expect(ratingSelect).toHaveValue("1");
    });
  },
};

export const ReactionFailuresRestoreOptimisticState: Story = {
  args: {
    canWriteReview: true,
    initialReviews: [
      {
        ...makeReview(31),
        rating: 5,
        title: "반응 롤백을 확인하는 리뷰",
        recommendCount: 2,
        disrecommendCount: 1,
        myReaction: null,
      },
    ],
    initialSummary: buildPartnerReviewSummary([5]),
    initialOffset: 1,
    initialHasMore: false,
  },
  loaders: [
    async () => ({
      fetchHarness: mockDeferredFetch(),
    }),
  ],
  play: async ({ canvasElement, loaded }) => {
    const harness = getDeferredFetchHarness(loaded);
    const canvas = within(canvasElement);
    const recommendButton = canvas.getByRole("button", { name: "추천" });

    await expect(within(recommendButton).getByText("2")).toBeInTheDocument();
    await expect(recommendButton).not.toHaveClass("text-primary");

    await userEvent.click(recommendButton);
    const httpFailureRequest = await waitForRequest(harness, 0);
    await waitFor(() => {
      expect(within(recommendButton).getByText("3")).toBeInTheDocument();
      expect(recommendButton).toHaveClass("text-primary");
    });

    httpFailureRequest.response.resolve(
      createJsonResponse(
        { message: "리뷰 반응을 저장하지 못했습니다. 다시 시도해 주세요." },
        { ok: false, status: 500 },
      ),
    );
    await waitFor(() => {
      expect(
        canvas.getByText("리뷰 반응을 저장하지 못했습니다. 다시 시도해 주세요."),
      ).toBeInTheDocument();
      expect(within(recommendButton).getByText("2")).toBeInTheDocument();
      expect(recommendButton).not.toHaveClass("text-primary");
    });

    await userEvent.click(recommendButton);
    const networkFailureRequest = await waitForRequest(harness, 1);
    await waitFor(() => {
      expect(within(recommendButton).getByText("3")).toBeInTheDocument();
      expect(recommendButton).toHaveClass("text-primary");
    });

    networkFailureRequest.response.reject(new TypeError("Failed to fetch"));
    await waitFor(() => {
      expect(
        canvas.getByText(
          "리뷰 반응 처리 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
        ),
      ).toBeInTheDocument();
      expect(within(recommendButton).getByText("2")).toBeInTheDocument();
      expect(recommendButton).not.toHaveClass("text-primary");
    });
  },
};

export const StaleLoadMoreCannotAppendAfterRefresh: Story = {
  loaders: [
    async () => ({
      fetchHarness: mockDeferredFetch(),
    }),
  ],
  play: async ({ canvasElement, loaded }) => {
    const harness = getDeferredFetchHarness(loaded);
    const canvas = within(canvasElement);
    const prefetchedLoadMoreRequest = await waitForRequest(harness, 0);

    await userEvent.click(canvas.getByRole("button", { name: "더보기" }));
    const ratingSelect = canvas.getByLabelText("필터") as HTMLSelectElement;
    await expect(ratingSelect).toBeDisabled();

    forceSelectChangeWhileDisabled(ratingSelect, "5");
    const refreshRequest = await waitForRequest(harness, 1);
    const refreshedReview = {
      ...makeReview(40),
      rating: 5,
      title: "새 필터의 최신 목록",
    };
    refreshRequest.response.resolve(
      createJsonResponse({
        summary: buildPartnerReviewSummary([refreshedReview.rating]),
        items: [refreshedReview],
        nextOffset: 1,
        hasMore: false,
      }),
    );

    await waitFor(() => {
      expect(canvas.getByText(refreshedReview.title)).toBeInTheDocument();
      expect(ratingSelect).toHaveValue("5");
    });

    const staleReview = {
      ...makeReview(41),
      title: "뒤늦게 도착한 더보기 리뷰",
    };
    prefetchedLoadMoreRequest.response.resolve(
      createJsonResponse({
        summary: buildPartnerReviewSummary(allReviewRatings),
        items: [staleReview],
        nextOffset: 11,
        hasMore: false,
      }),
    );

    await waitFor(() => {
      expect(canvas.queryByText(staleReview.title)).not.toBeInTheDocument();
      expect(canvas.getByText(refreshedReview.title)).toBeInTheDocument();
    });
  },
};
