import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GraduateVerificationApplicationView from "./GraduateVerificationApplicationView";

const meta = {
  title: "Screens/Auth/GraduateVerificationApplication",
  component: GraduateVerificationApplicationView,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof GraduateVerificationApplicationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmailVerification: Story = {};
