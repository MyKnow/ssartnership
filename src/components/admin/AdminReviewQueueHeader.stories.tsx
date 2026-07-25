import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminReviewQueueHeader from "./AdminReviewQueueHeader";

const meta = {
  title: "Domains/Admin/ReviewQueueHeader",
  component: AdminReviewQueueHeader,
  args: {
    eyebrow: "Review queue",
    title: "검토 큐",
    description: "대기 항목과 다음 행동을 확인합니다.",
    metrics: [
      { label: "승인 대기", value: "12건", hint: "현재 처리할 요청" },
      { label: "검토 중", value: "3건", hint: "관리자 확인 중" },
    ],
    nextAction: {
      title: "오래된 요청부터 확인하세요.",
      description: "필터와 복귀 맥락을 유지한 채 항목을 처리합니다.",
    },
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminReviewQueueHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ErrorFeedback: Story = {
  args: {
    feedback: {
      tone: "danger",
      title: "승인하지 못했습니다",
      description: "목록을 새로고침한 뒤 다시 확인해 주세요.",
    },
  },
};

export const SuccessFeedback: Story = {
  args: {
    feedback: {
      tone: "success",
      title: "처리 완료",
      description: "검토 항목을 승인했습니다.",
    },
  },
};

export const LongKorean: Story = {
  args: {
    title: "서울 캠퍼스 제휴 등록 신청 검토 및 후속 조치",
    description:
      "긴 한국어 설명과 상태 안내가 액션을 밀어내지 않고 자연스럽게 줄바꿈되는지 확인하는 상태입니다.",
    nextAction: {
      title: "신규 카테고리와 여러 지점이 포함된 신청부터 확인하세요.",
      description:
        "검토 중인 항목의 조건과 관리자 메모를 보존하면서 다음 화면으로 이동할 수 있어야 합니다.",
    },
  },
};
