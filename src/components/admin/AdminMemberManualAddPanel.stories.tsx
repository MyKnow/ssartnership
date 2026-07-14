import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberManualAddPanel from "./AdminMemberManualAddPanel";

const meta = {
  title: "Screens/Admin/ManualMemberImport",
  component: AdminMemberManualAddPanel,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberManualAddPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
