import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminWebVitalSummaryPanel from "./AdminWebVitalSummaryPanel";

const meta = {
  title: "Domains/Admin/AdminWebVitalSummaryPanel",
  component: AdminWebVitalSummaryPanel,
  parameters: { layout: "padded" },
  args: {
    windowDays: 7,
    loadError: false,
    metrics: [
      {
        metric: "INP",
        label: "상호작용 응답",
        threshold: 200,
        sampleCount: 184,
        p75Value: 164,
        goodCount: 170,
        needsImprovementCount: 12,
        poorCount: 2,
        status: "met",
      },
      {
        metric: "LCP",
        label: "첫 유용 콘텐츠",
        threshold: 2500,
        sampleCount: 184,
        p75Value: 2830,
        goodCount: 128,
        needsImprovementCount: 46,
        poorCount: 10,
        status: "exceeded",
      },
      {
        metric: "TTFB",
        label: "서버 응답",
        threshold: 800,
        sampleCount: 0,
        p75Value: null,
        goodCount: 0,
        needsImprovementCount: 0,
        poorCount: 0,
        status: "unknown",
      },
    ],
  },
} satisfies Meta<typeof AdminWebVitalSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metrics: Story = {};

export const LoadError: Story = {
  args: {
    loadError: true,
  },
};
