import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ManualMemberPasswordSetupView from "./ManualMemberPasswordSetupView";

const meta = {
  title: "Screens/Auth/ManualMemberPasswordSetup",
  component: ManualMemberPasswordSetupView,
  args: {
    initialToken: "synthetic-manual-member-setup-token",
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof ManualMemberPasswordSetupView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MissingToken: Story = {
  args: { initialToken: undefined },
};
