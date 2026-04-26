"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { PartnerReview } from "@/lib/partner-reviews";
import PartnerReviewForm from "./PartnerReviewForm";

const existingReview: PartnerReview = {
  id: "review-1",
  partnerId: "partner-1",
  memberId: "member-1",
  rating: 4,
  title: "점심 시간에도 응대가 안정적이었습니다",
  body: "제휴 인증 과정이 빠르고 좌석 회전이 빨라서 수업 전후 이용이 편했습니다.",
  images: [],
  createdAt: "2026-04-25T11:00:00.000Z",
  updatedAt: "2026-04-25T11:00:00.000Z",
  authorMaskedName: "김**",
  authorRoleLabel: "15기 교육생",
  isMine: true,
  isHidden: false,
  hiddenAt: null,
  recommendCount: 12,
  disrecommendCount: 1,
  myReaction: null,
};

const meta = {
  title: "Domains/PartnerReviewForm",
  component: PartnerReviewForm,
  args: {
    partnerId: "partner-1",
    onCancel: fn(),
    onSubmitted: fn(),
  },
} satisfies Meta<typeof PartnerReviewForm>;

export default meta;

type Story = StoryObj<typeof meta>;

function mockReviewFetch(response: {
  ok: boolean;
  status?: number;
  body: Record<string, unknown>;
}) {
  const fetchMock = fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.body,
  })) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = mockReviewFetch({ ok: true, body: { success: true } });

    await userEvent.type(canvas.getByPlaceholderText("리뷰 제목"), "제휴 인증이 빨랐습니다");
    await userEvent.type(
      canvas.getByPlaceholderText("이용 경험을 남겨 주세요."),
      "점심 시간에도 응대가 안정적이고 할인 적용이 빨랐습니다.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "등록" }));

    await expect(fetchMock).toHaveBeenCalled();
    await expect(args.onSubmitted).toHaveBeenCalled();
  },
};

export const CreateValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "등록" }));
    await expect(canvas.getByText("제목을 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("리뷰 내용을 입력해 주세요.")).toBeInTheDocument();
  },
};

export const Edit: Story = {
  args: {
    review: existingReview,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = mockReviewFetch({
      ok: false,
      status: 422,
      body: {
        message: "리뷰 수정에 실패했습니다.",
        fieldErrors: {
          title: "제목을 다시 확인해 주세요.",
        },
      },
    });

    await userEvent.clear(canvas.getByPlaceholderText("리뷰 제목"));
    await userEvent.type(canvas.getByPlaceholderText("리뷰 제목"), "수정된 리뷰 제목");
    await userEvent.click(canvas.getByRole("button", { name: "수정 완료" }));

    await expect(fetchMock).toHaveBeenCalled();
    await expect(canvas.getByText("리뷰 수정에 실패했습니다.")).toBeInTheDocument();
    await expect(args.onSubmitted).not.toHaveBeenCalled();
  },
};

export const CreateNetworkError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    globalThis.fetch = fn(async () => {
      throw new Error("네트워크 오류");
    }) as unknown as typeof fetch;

    await userEvent.type(canvas.getByPlaceholderText("리뷰 제목"), "네트워크 오류 테스트");
    await userEvent.type(
      canvas.getByPlaceholderText("이용 경험을 남겨 주세요."),
      "오프라인 상태에서도 사용자에게 명확한 오류가 보여야 합니다.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "등록" }));

    await expect(canvas.getByText("네트워크 오류")).toBeInTheDocument();
  },
};

export const Cancel: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "취소" }));

    await expect(args.onCancel).toHaveBeenCalled();
  },
};
