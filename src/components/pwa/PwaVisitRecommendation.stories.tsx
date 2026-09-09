import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PwaVisitRecommendationSurface } from "./PwaVisitRecommendation";

const meta = {
  title: "Domains/PwaVisitRecommendation",
  component: PwaVisitRecommendationSurface,
  args: {
    onDismiss: fn(),
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[28rem] bg-background">
        <div className="safe-site-header-spacer border-b border-border bg-surface-overlay" />
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PwaVisitRecommendationSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("홈 화면에서 더 넓게 이용해 보세요"),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("link", { name: "설치 방법 보기" }),
    ).toHaveAttribute("href", "/install?platform=other");
    await userEvent.click(canvas.getByRole("button", { name: "나중에" }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};
