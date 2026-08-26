import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { MemberEmailVerificationPageSkeleton } from "@/components/loading/SitePageSkeletons";

const meta = {
  title: "Loading/MemberEmailVerificationPageSkeleton",
  component: MemberEmailVerificationPageSkeleton,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
} satisfies Meta<typeof MemberEmailVerificationPageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText("로그인·복구 이메일 불러오는 중"),
    ).toHaveAttribute("aria-busy", "true");
  },
};
