import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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

export const InternalLink: Story = {
  args: {
    href: "/partners/partner-1",
    children: "상세 보기",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "상세 보기" })).toHaveAttribute(
      "href",
      "/partners/partner-1",
    );
  },
};

export const ExternalBlankLink: Story = {
  args: {
    href: "https://example.com",
    target: "_blank",
    children: "외부 링크",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "외부 링크" });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};

export const DisabledLink: Story = {
  args: {
    href: "https://example.com",
    disabled: true,
    children: "비활성 링크",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "비활성 링크" });
    await expect(link).toHaveAttribute("aria-disabled", "true");
    await expect(link).toHaveAttribute("tabindex", "-1");
  },
};

export const ClickButton: Story = {
  args: {
    children: "클릭 버튼",
    onClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "클릭 버튼" }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
