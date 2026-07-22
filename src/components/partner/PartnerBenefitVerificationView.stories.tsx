import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import Container from "@/components/ui/Container";
import PartnerBenefitVerificationView from "./PartnerBenefitVerificationView";

const meta = {
  title: "Screens/Public/PartnerBenefitVerificationView",
  component: PartnerBenefitVerificationView,
  args: {
    partnerId: "00000000-0000-4000-8000-000000000001",
    partnerName: "카페 싸피 역삼점",
    benefit: "아메리카노 1+1 및 디저트 20% 할인",
    useCount: 2,
    member: {
      mattermostUsername: "story-member",
      displayName: "김싸피",
      generation: 15,
      campus: "서울",
      profileImageUrl: null,
    },
    cohortCardThemes: [],
    initialTimestamp: "2026-07-20T06:00:00.000Z",
    pinConfigured: true,
  },
  render: (args) => (
    <Container className="pb-12 pt-6" size="wide">
      <PartnerBenefitVerificationView {...args} />
    </Container>
  ),
} satisfies Meta<typeof PartnerBenefitVerificationView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId("certification-card-frame")).toBeVisible();
    await expect(canvas.getByTestId("certification-card-frame")).toHaveClass("!aspect-[16/9]");
    const certificationCard = canvas.getByTestId("certification-card-frame");
    const certificationFooter = certificationCard.querySelector<HTMLElement>(
      "[data-certification-card-footer]",
    );
    await expect(certificationFooter).not.toBeNull();
    await expect(certificationFooter!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      certificationCard.getBoundingClientRect().bottom + 1,
    );
    await expect(canvas.getByText("카페 싸피 역삼점")).toBeVisible();
    await expect(canvas.getByText("아메리카노 1+1 및 디저트 20% 할인")).toBeVisible();
    const pinInput = canvasElement.querySelector<HTMLInputElement>(
      'input[name="partnerBenefitPin"]',
    );
    await expect(pinInput).not.toBeNull();
    await expect(pinInput).toHaveAttribute("inputmode", "numeric");
    await expect(pinInput).toHaveAttribute("maxlength", "4");
    await expect(
      canvas.getByRole("button", { name: "인증 카드와 혜택 확인" }),
    ).toBeVisible();
  },
};

export const PinNotConfigured: Story = {
  args: {
    pinConfigured: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId("certification-card-frame")).toBeVisible();
    await expect(canvas.getByText("카페 싸피 역삼점")).toBeVisible();
    await expect(canvas.getByText("아메리카노 1+1 및 디저트 20% 할인")).toBeVisible();
    await expect(
      canvasElement.querySelector('input[name="partnerBenefitPin"]'),
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "인증 카드와 혜택 확인" }),
    ).not.toBeInTheDocument();
  },
};
