import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminCycleView from "./AdminCycleView";

const meta = {
  title: "Domains/Admin/AdminCycleView",
  component: AdminCycleView,
  args: {
    settings: {
      anchorYear: 14,
      anchorCalendarYear: 2025,
      anchorMonth: 7,
      manualCurrentYear: null,
      manualReason: null,
      manualAppliedAt: null,
      manualMemberMmLookupGenerations: [14, 15],
      createdAt: "2026-01-01T00:00:00+09:00",
      updatedAt: "2026-07-01T00:00:00+09:00",
    },
    overview: {
      currentYear: 16,
      currentSemester: 2,
      studentYears: [15, 16],
      staffYear: 0,
      graduateThresholdYear: 14,
      nextSemesterStartLabel: "2027년 1월 1일",
      nextCohortStartLabel: "2027년 7월 1일",
    },
    themes: [],
    currentSemester: 2,
    initialTimestamp: "2026-07-10T10:00:00+09:00",
    updateSettingsAction: async () => {},
    earlyStartAction: async () => {},
    restoreAction: async () => {},
    upsertThemeAction: async () => {},
    deleteThemeAction: async () => {},
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminCycleView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
