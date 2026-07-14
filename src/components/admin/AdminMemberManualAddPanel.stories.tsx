import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import AdminMemberManualAddPanel from "./AdminMemberManualAddPanel";

const meta = {
  title: "Screens/Admin/ManualMemberImport",
  component: AdminMemberManualAddPanel,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberManualAddPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RowsReady: Story = {
  args: {
    initialRows: [
      {
        rowNumber: 2,
        generation: "15",
        name: "홍길동",
        campus: "서울",
        mmId: "hong.gildong",
        email: "hong@example.com",
        photoFilename: "hong.webp",
      },
      {
        rowNumber: 3,
        generation: "16",
        name: "김싸피",
        campus: "서울",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "",
      },
    ],
  },
};

export const AddsAndRemovesRow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "행 추가" }));
    await expect(canvas.getByText("1번째 회원")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "행 삭제" }));
    await expect(canvas.getByText(/행 추가를 누르거나 회원 XLSX를 업로드/)).toBeVisible();
  },
};
