import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SubmitButton from "./SubmitButton";

const meta = {
  title: "UI/SubmitButton",
  component: SubmitButton,
  args: {
    children: "저장",
    pendingText: "저장 중",
    variant: "primary",
  },
  render: (args) => (
    <form className="max-w-sm space-y-4">
      <SubmitButton {...args} />
    </form>
  ),
} satisfies Meta<typeof SubmitButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
  args: {
    children: "임시 저장",
    variant: "secondary",
  },
};

export const Disabled: Story = {
  args: {
    children: "검토 요청",
    disabled: true,
  },
};
