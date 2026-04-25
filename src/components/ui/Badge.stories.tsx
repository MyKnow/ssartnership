import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Badge from "./Badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: {
    children: "상태",
    variant: "neutral",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">기본</Badge>
      <Badge variant="primary">진행 중</Badge>
      <Badge variant="success">완료</Badge>
      <Badge variant="warning">주의</Badge>
      <Badge variant="danger">오류</Badge>
    </div>
  ),
};
