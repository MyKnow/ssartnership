import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Button from "./Button";
import EmptyState from "./EmptyState";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  args: {
    title: "등록된 제휴처가 없습니다",
    description: "필터 조건을 조정하거나 새 제휴처를 추가해 목록을 채우세요.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    action: <Button>제휴처 추가</Button>,
  },
};

export const Compact: Story = {
  args: {
    title: "검색 결과가 없습니다",
    description: "입력한 키워드를 다시 확인해 주세요.",
    className: "px-4 py-7",
  },
};
