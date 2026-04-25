import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PasswordInput from "./PasswordInput";

const meta = {
  title: "UI/PasswordInput",
  component: PasswordInput,
  args: {
    placeholder: "비밀번호를 입력하세요",
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: "ssafy-partner-2026",
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: "locked-password",
    disabled: true,
  },
};
