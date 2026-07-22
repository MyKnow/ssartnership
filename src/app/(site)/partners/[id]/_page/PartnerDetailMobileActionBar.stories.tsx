import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import PartnerDetailMobileActionBar from "./PartnerDetailMobileActionBar";

const benefitUseAction = {
  label: "인증하고 혜택 이용",
  href: "/certification",
  type: "certification" as const,
};

const certificationBenefitAction = {
  partnerId: "00000000-0000-4000-8000-000000000001",
  partnerName: "피치플레이헬스&필라테스 역삼점",
  benefitItems: [
    {
      id: "story-benefit-1",
      title: "헬스 1개월 33,000원",
      maxApplyCount: null,
    },
    {
      id: "story-benefit-2",
      title: "필라테스 3개월 내 10회 199,000원",
      maxApplyCount: null,
    },
  ],
  returnTo: "/partners/00000000-0000-4000-8000-000000000001",
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
    certificationBenefitAction,
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
    const benefit = within(actionGrid!).getByRole("button", {
      name: "혜택 이용하기",
    });
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
    await expect(benefit).toHaveClass("h-12", "rounded-[1rem]", "bg-primary");
    await expect(inquiry).toHaveClass(
      "h-12",
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
    certificationBenefitAction: null,
    inquiryAction,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inquiry = canvas.getByRole("link", {
      name: "문의하기: 0507-1234-5678",
    });

    await expect(inquiry).toHaveClass("h-12", "w-full", "bg-primary");
  },
};

export const BenefitOnly: Story = {
  args: {
    benefitUseAction,
    certificationBenefitAction,
    inquiryAction: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const benefit = canvas.getByRole("button", { name: "혜택 이용하기" });

    await expect(benefit).toHaveClass("h-12", "w-full", "bg-primary");
  },
};

export const ExternalBenefit: Story = {
  args: {
    benefitUseAction: {
      label: "혜택 이용",
      href: "https://booking.example.com/benefit",
      type: "external_link" as const,
    },
    certificationBenefitAction: null,
    inquiryAction: null,
  },
  play: async ({ canvasElement }) => {
    const benefit = within(canvasElement).getByRole("link", {
      name: "혜택 이용하기",
    });

    await expect(benefit).toHaveAttribute(
      "href",
      "https://booking.example.com/benefit",
    );
    await expect(benefit).toHaveAttribute("target", "_blank");
    await expect(benefit).toHaveClass("h-12", "w-full", "bg-primary");
  },
};
