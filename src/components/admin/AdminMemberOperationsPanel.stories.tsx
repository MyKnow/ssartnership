import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import AdminMemberOperationsPanel from "./AdminMemberOperationsPanel";

const meta = {
  title: "Domains/Admin/AdminMemberOperationsPanel",
  component: AdminMemberOperationsPanel,
  args: {
    backfillAction: fn(async () => {}),
    disableGenerationAction: fn(async () => {}),
    hasMoreBackfill: false,
    backfillCursor: "",
    backfillBatchSize: 50,
    defaultBatchSize: 50,
    maxBatchSize: 100,
    selectedGeneration: 15,
    generationMattermostLoginTargetCount: 3,
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberOperationsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GenerationScope: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("실행 대상 3명")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "15기 MM 로그인 중단" }),
    ).toBeEnabled();
  },
};

export const NoTarget: Story = {
  args: {
    generationMattermostLoginTargetCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("실행 대상 0명")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "15기 MM 로그인 중단" }),
    ).toBeDisabled();
  },
};

export const NoGenerationSelected: Story = {
  args: {
    selectedGeneration: null,
    generationMattermostLoginTargetCount: null,
  },
};
