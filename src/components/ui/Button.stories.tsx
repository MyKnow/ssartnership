import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Button from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "버튼",
    variant: "primary",
    size: "md",
    disabled: false,
    loading: false,
  },
  argTypes: {
    onClick: { action: "clicked" },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "보조 액션",
  },
};

export const Soft: Story = {
  args: {
    variant: "soft",
    children: "강조 보조",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "삭제",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    loadingText: "처리 중",
    children: "저장",
  },
};

export const IconOnly: Story = {
  args: {
    size: "icon",
    ariaLabel: "도구",
    children: "+",
  },
};
