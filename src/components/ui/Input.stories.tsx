import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Input from "./Input";

const meta = {
  title: "UI/Input",
  component: Input,
  args: {
    placeholder: "텍스트를 입력하세요",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: "역삼 제휴처 검색",
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: "비활성 입력",
    disabled: true,
  },
};
