import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
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

export const PendingAfterSubmit: Story = {
  render: (args) => (
    <form
      className="max-w-sm space-y-4"
      action={() => new Promise<void>(() => undefined)}
    >
      <SubmitButton {...args} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "저장" }));

    const pendingButton = await canvas.findByRole("button", { name: "저장 중" });
    await expect(pendingButton).toBeDisabled();
    await expect(pendingButton).toHaveAttribute("aria-busy", "true");
  },
};
