import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminLogsAncillaryFallback } from "./AdminLogsAncillaryPanels";

const meta = {
  title: "Domains/Admin/AdminLogsAncillaryPanels",
  component: AdminLogsAncillaryFallback,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminLogsAncillaryFallback>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
