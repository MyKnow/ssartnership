import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import PartnerDetailAccessGate from "./PartnerDetailAccessGate";

const meta = {
  title: "Screens/Public/PartnerDetailAccessGate",
  component: PartnerDetailAccessGate,
  args: {
    returnTo: "/partners/health-001",
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof PartnerDetailAccessGate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Locked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "SSAFY 구성원만 열람할 수 있는 혜택입니다",
      }),
    ).toBeVisible();
    await expect(
      canvas.getByText("로그인하거나 회원가입을 완료하면 이 페이지로 돌아옵니다."),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: "회원가입" })).toHaveAttribute(
      "href",
      "/auth/signup?returnTo=%2Fpartners%2Fhealth-001",
    );
    await expect(canvas.getByRole("link", { name: "로그인" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fpartners%2Fhealth-001",
    );
  },
};
