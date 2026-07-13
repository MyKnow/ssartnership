import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GraduatePasswordSetupView from "./GraduatePasswordSetupView";

const meta = {
  title: "Screens/Auth/GraduatePasswordSetup",
  component: GraduatePasswordSetupView,
  args: {
    initialToken: "synthetic-graduate-password-token",
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof GraduatePasswordSetupView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
