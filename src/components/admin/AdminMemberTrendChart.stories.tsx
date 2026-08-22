import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberTrendChart from "./AdminMemberTrendChart";

const recentCreatedAts = [
  "2026-07-20T09:10:00+09:00",
  "2026-07-21T10:25:00+09:00",
  "2026-07-21T15:40:00+09:00",
  "2026-07-22T08:55:00+09:00",
  "2026-07-23T11:30:00+09:00",
  "2026-07-24T13:05:00+09:00",
  "2026-07-24T16:45:00+09:00",
  "2026-07-25T09:20:00+09:00",
  "2026-07-26T14:15:00+09:00",
];

const longRangeCreatedAts = [
  "2023-03-11T09:00:00+09:00",
  "2023-11-02T12:00:00+09:00",
  "2024-04-18T10:30:00+09:00",
  "2024-10-06T16:20:00+09:00",
  "2025-01-14T08:40:00+09:00",
  "2025-05-23T14:10:00+09:00",
  "2025-09-09T11:50:00+09:00",
  "2026-01-07T13:15:00+09:00",
  "2026-07-26T14:15:00+09:00",
];

const meta = {
  title: "Domains/Admin/AdminMemberTrendChart",
  component: AdminMemberTrendChart,
  args: {
    createdAts: recentCreatedAts,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberTrendChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { createdAts: [] },
};

export const LongRange: Story = {
  args: { createdAts: longRangeCreatedAts },
};
