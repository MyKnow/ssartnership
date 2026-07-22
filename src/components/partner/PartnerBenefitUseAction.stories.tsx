import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import PartnerBenefitUseAction from "./PartnerBenefitUseAction";

const meta = {
  title: "Domains/Partner/PartnerBenefitUseAction",
  component: PartnerBenefitUseAction,
  args: {
    action: {
      partnerId: "00000000-0000-4000-8000-000000000001",
      partnerName: "피치플레이헬스&필라테스 역삼점",
      benefitItems: [
        { id: "benefit-health", title: "헬스 1개월 33,000원", maxApplyCount: 3 },
        { id: "benefit-pilates", title: "필라테스 3개월 내 10회 199,000원", maxApplyCount: null },
      ],
      returnTo: "/partners/00000000-0000-4000-8000-000000000001",
    },
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
} satisfies Meta<typeof PartnerBenefitUseAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileBottomSheet: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "혜택 이용하기" }),
    );

    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "혜택 이용하기" });
    const overlay = dialog.parentElement;
    const handle = dialog.querySelector<HTMLElement>(
      "[data-partner-benefit-use-sheet-handle]",
    );

    await expect(overlay).toHaveClass(
      "items-end",
      "bg-slate-950/60",
      "dark:bg-black/75",
      "p-0",
      "sm:items-center",
      "sm:p-6",
    );
    await expect(dialog).toHaveClass(
      "rounded-t-[2rem]",
      "border-x-0",
      "border-b-0",
      "sm:rounded-[1.5rem]",
      "sm:border",
    );
    await expect(handle).not.toBeNull();
    if (window.innerWidth < 640) {
      await expect(
        Math.abs(dialog.getBoundingClientRect().bottom - window.innerHeight),
      ).toBeLessThanOrEqual(1);
    }
  },
};
