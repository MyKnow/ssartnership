import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminTaskOutcomeSummaryPanel from "./AdminTaskOutcomeSummaryPanel";

const meta = {
  title: "Domains/Admin/AdminTaskOutcomeSummaryPanel",
  component: AdminTaskOutcomeSummaryPanel,
  parameters: { layout: "padded" },
  args: {
    windowDays: 7,
    loadError: false,
    metrics: [
      {
        taskKey: "admin.partner-requests",
        label: "변경 요청",
        startCount: 184,
        completeCount: 170,
        recoveryCount: 12,
        completionRate: 92.4,
        recoveryRate: 6.5,
        p75DurationMs: 286,
        status: "observed",
      },
      {
        taskKey: "admin.members",
        label: "회원 검색",
        startCount: 12,
        completeCount: 11,
        recoveryCount: 1,
        completionRate: 91.7,
        recoveryRate: 8.3,
        p75DurationMs: 148,
        status: "insufficient_sample",
      },
    ],
  },
} satisfies Meta<typeof AdminTaskOutcomeSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metrics: Story = {};

export const Empty: Story = {
  args: { metrics: [] },
};

export const LoadError: Story = {
  args: { loadError: true },
};
