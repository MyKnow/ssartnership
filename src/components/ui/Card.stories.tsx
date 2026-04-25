import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Badge from "./Badge";
import Button from "./Button";
import Card from "./Card";

const meta = {
  title: "UI/Card",
  component: Card,
  args: {
    tone: "default",
    padding: "lg",
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="max-w-xl">
      <div className="grid gap-4">
        <Badge variant="primary" className="w-fit">
          Partner
        </Badge>
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold text-foreground">차분한 정보 카드</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            기본 카드 톤은 정보 밀도가 높은 화면에서도 배경 위계가 자연스럽게 읽히도록 설계되어 있습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary">확인</Button>
          <Button variant="secondary">취소</Button>
        </div>
      </div>
    </Card>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card tone="default" padding="md">기본</Card>
      <Card tone="muted" padding="md">보조</Card>
      <Card tone="elevated" padding="md">상승</Card>
      <Card tone="hero" padding="md">Hero</Card>
    </div>
  ),
};
