import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminRouteTimingSummaryPanel from "./AdminRouteTimingSummaryPanel";

const meta = {
  title: "Domains/Admin/AdminRouteTimingSummaryPanel",
  component: AdminRouteTimingSummaryPanel,
  parameters: { layout: "padded" },
  args: {
    windowDays: 7,
    loadError: false,
    metrics: [
      {
        routeKey: "admin.partners.detail",
        label: "제휴처 상세",
        threshold: 200,
        sampleCount: 184,
        p75DurationMs: 286,
        completeCount: 180,
        unknownCount: 3,
        errorCount: 1,
        status: "exceeded",
      },
      {
        routeKey: "admin.tasks",
        label: "작업함",
        threshold: 200,
        sampleCount: 76,
        p75DurationMs: 148,
        completeCount: 76,
        unknownCount: 0,
        errorCount: 0,
        status: "met",
      },
    ],
  },
} satisfies Meta<typeof AdminRouteTimingSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metrics: Story = {};

export const InsufficientSamples: Story = {
  args: {
    metrics: [
      {
        routeKey: "admin.members",
        label: "회원 관리",
        threshold: 200,
        sampleCount: 12,
        p75DurationMs: 164,
        completeCount: 12,
        unknownCount: 0,
        errorCount: 0,
        status: "insufficient_sample",
      },
    ],
  },
};

export const Empty: Story = {
  args: { metrics: [] },
};

export const LoadError: Story = {
  args: { loadError: true },
};
