"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import BugReportView from "@/components/support/BugReportView";
import { ToastProvider } from "@/components/ui/Toast";
import { BUG_REPORT_TEMPLATE } from "@/lib/support-mail";

const meta = {
  title: "Screens/Public/BugReportView",
  component: BugReportView,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    template: BUG_REPORT_TEMPLATE,
  },
} satisfies Meta<typeof BugReportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
