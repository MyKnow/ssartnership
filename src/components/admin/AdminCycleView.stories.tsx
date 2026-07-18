import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "기수별 운영" })).toBeInTheDocument();
    await expect(canvas.getByRole("combobox", { name: "표시할 기수" })).toHaveValue("16");
    await expect(canvas.getByRole("heading", { name: "16기 운영" })).toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "15기 운영" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "14기 운영" })).not.toBeInTheDocument();
  },
};

export const SelectedGeneration15: Story = {
  args: {
    requestedGeneration: "15",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("combobox", { name: "표시할 기수" })).toHaveValue("15");
    await expect(canvas.getByRole("heading", { name: "15기 운영" })).toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "16기 운영" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "14기 운영" })).not.toBeInTheDocument();
  },
};

export const MattermostSenderManagement: Story = {
  args: {
    mattermostSenders: [
      {
        id: "5f1925b4-0b5a-47d7-88cb-d120c7eb2d68",
        generation: 16,
        status: "pending",
        loginIdHint: "se***6",
        senderUsernameHint: null,
        verifiedAt: null,
        lastTestedAt: "2026-07-17T10:20:00+09:00",
        lastTestTargetKind: null,
        lastErrorCode: "test_target_unavailable",
        expiresAt: "2026-07-18T10:00:00+09:00",
        createdAt: "2026-07-17T10:00:00+09:00",
        updatedAt: "2026-07-17T10:20:00+09:00",
      },
      {
        id: "1471902a-e6a8-4f68-9d0c-07ccb7c612cb",
        generation: 15,
        status: "active",
        loginIdHint: "se***5",
        senderUsernameHint: "se***5",
        verifiedAt: "2026-07-10T10:00:00+09:00",
        lastTestedAt: "2026-07-10T10:00:00+09:00",
        lastTestTargetKind: "super_admin_bootstrap",
        lastErrorCode: null,
        expiresAt: null,
        createdAt: "2026-07-10T09:55:00+09:00",
        updatedAt: "2026-07-10T10:00:00+09:00",
      },
      {
        id: "c4b7e23d-c8e3-4a22-becf-5397ee850b58",
        generation: 14,
        status: "superseded",
        loginIdHint: "se***4",
        senderUsernameHint: "se***4",
        verifiedAt: "2026-06-01T10:00:00+09:00",
        lastTestedAt: "2026-06-01T10:00:00+09:00",
        lastTestTargetKind: "previous_generation_sender",
        lastErrorCode: null,
        expiresAt: null,
        createdAt: "2026-06-01T09:55:00+09:00",
        updatedAt: "2026-07-10T10:00:00+09:00",
      },
    ],
    mattermostSenderLoadError: false,
    saveMattermostSenderAction: async () => {},
    testMattermostSenderAction: async () => {},
    disableMattermostSenderAction: async () => {},
  },
  play: async ({ canvasElement }) => {
    const themeManagerElement = canvasElement.querySelector("#card-theme-manager");
    if (!(themeManagerElement instanceof HTMLElement)) {
      throw new Error("카드 색상 관리 영역을 찾지 못했습니다.");
    }
    const themeManager = within(themeManagerElement);
    await expect(themeManager.getAllByRole("spinbutton")).toHaveLength(1);
  },
};
