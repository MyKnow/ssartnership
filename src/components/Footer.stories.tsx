import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import Footer from "@/components/Footer";

const meta = {
  title: "Screens/Public/Footer",
  component: Footer,
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("combobox", {
        name: "캠퍼스별 제휴 페이지 이동",
      }),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText("캠퍼스")).not.toBeInTheDocument();
    await expect(
      canvas.queryByText(
        "SSAFY 구성원을 위한 제휴 혜택, 공지와 정책을 한곳에서 확인합니다.",
      ),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText("운영")).toBeVisible();
    await expect(canvas.getByText("문의")).toBeVisible();
    await expect(canvas.getByText("설정")).toBeVisible();
    await expect(canvas.getByText("약관")).toBeVisible();
  },
};
