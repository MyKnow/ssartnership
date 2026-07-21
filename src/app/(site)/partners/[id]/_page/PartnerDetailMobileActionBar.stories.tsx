import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import PartnerDetailMobileActionBar from "./PartnerDetailMobileActionBar";

const benefitUseAction = {
  label: "혜택 이용하기",
  href: "/certification",
  type: "certification" as const,
};

const inquiryAction = {
  label: "0507-1234-5678",
  href: "tel:050712345678",
};

const meta = {
  title: "Screens/Public/PartnerDetailMobileActionBar",
  component: PartnerDetailMobileActionBar,
  args: {
    partnerId: "00000000-0000-4000-8000-000000000001",
    benefitUseAction,
    inquiryAction,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  render: (args) => (
    <div className="min-h-[40rem] bg-background">
      <PartnerDetailMobileActionBar {...args} />
    </div>
  ),
} satisfies Meta<typeof PartnerDetailMobileActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BenefitAndInquiry: Story = {
  play: async ({ canvasElement }) => {
    const actionGrid = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-mobile-action-buttons]",
    );
    const benefit = actionGrid?.querySelector<HTMLAnchorElement>(
      'a[href="/certification"]',
    );
    const inquiry = actionGrid?.querySelector<HTMLAnchorElement>(
      'a[aria-label="문의하기: 0507-1234-5678"]',
    );
    const actionBar = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-mobile-action-bar]",
    );

    await expect(actionGrid).not.toBeNull();
    await expect(benefit).not.toBeNull();
    await expect(inquiry).not.toBeNull();
    await expect(actionGrid).toHaveClass("grid-cols-2", "gap-2");
    await expect(actionBar).toHaveClass("pb-safe-bottom-2");
    await expect(benefit).toHaveClass("h-14", "rounded-[1rem]", "bg-primary");
    await expect(inquiry).toHaveClass(
      "h-14",
      "rounded-[1rem]",
      "bg-surface-muted",
    );
    await expect(
      Math.abs(
        benefit!.getBoundingClientRect().width -
          inquiry!.getBoundingClientRect().width,
      ),
    ).toBeLessThanOrEqual(1);
  },
};

export const InquiryOnly: Story = {
  args: {
    benefitUseAction: null,
    inquiryAction,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inquiry = canvas.getByRole("link", {
      name: "문의하기: 0507-1234-5678",
    });

    await expect(inquiry).toHaveClass("h-14", "w-full", "bg-primary");
  },
};

export const BenefitOnly: Story = {
  args: {
    benefitUseAction,
    inquiryAction: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const benefit = canvas.getByRole("link", { name: "혜택 이용하기" });

    await expect(benefit).toHaveClass("h-14", "w-full", "bg-primary");
  },
};
