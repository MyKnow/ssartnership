import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminPrefetchSummaryPanel from "./AdminPrefetchSummaryPanel";

const meta = {
  title: "Domains/Admin/AdminPrefetchSummaryPanel",
  component: AdminPrefetchSummaryPanel,
  parameters: {
    layout: "padded",
    chromatic: { viewports: [360, 820, 1366] },
  },
  args: {
    windowDays: 7,
    loadError: false,
    metrics: [
      {
        routeKey: "admin.members",
        label: "회원 관리",
        threshold: 60,
        sampleCount: 86,
        usedCount: 61,
        utilizationRate: 71,
        status: "met",
      },
      {
        routeKey: "admin.partners.detail",
        label: "제휴처 상세",
        threshold: 60,
        sampleCount: 42,
        usedCount: 18,
        utilizationRate: 43,
        status: "exceeded",
      },
    ],
  },
} satisfies Meta<typeof AdminPrefetchSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metrics: Story = {};

export const InsufficientSamples: Story = {
  args: {
    metrics: [
      {
        routeKey: "admin.tasks",
        label: "작업함",
        threshold: 60,
        sampleCount: 8,
        usedCount: 7,
        utilizationRate: 87.5,
        status: "insufficient_sample",
      },
    ],
  },
};

export const Empty: Story = { args: { metrics: [] } };

export const LoadError: Story = { args: { loadError: true } };
