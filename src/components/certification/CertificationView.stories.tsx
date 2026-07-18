import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import CertificationView from "@/components/certification/CertificationView";
import PageHeader from "@/components/ui/PageHeader";

function CertificationScreenStory({
  displayName,
  campus,
}: {
  displayName: string;
  campus: string;
}) {
  return (
    <div
      data-testid="certification-screen-content"
      className="mx-auto w-full max-w-4xl space-y-6"
    >
      <PageHeader
        eyebrow="Member"
        title="내 인증"
        description="현재 계정의 인증 상태와 표시 정보를 확인합니다."
        backHref="/#benefits"
        backLabel="혜택 화면으로 돌아가기"
      />
      <CertificationView
        member={{
          mattermostUsername: "story-member",
          displayName,
          generation: 15,
          campus,
        }}
        initialTimestamp="2026-07-10T10:00:00.000+09:00"
        disableTracking
      />
    </div>
  );
}

function CertificationRoleVariantsStory() {
  const variants = [
    {
      key: "staff",
      displayName: "손병찬",
      generation: 0,
      campus: "서울",
    },
    {
      key: "student",
      displayName: "김싸피",
      generation: 15,
      campus: "서울",
    },
    {
      key: "graduate",
      displayName: "최현진",
      generation: 14,
      campus: "서울",
      graduateVerifiedAt: "2026-04-02T02:00:00.000Z",
    },
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      {variants.map((variant) => (
        <CertificationView
          key={variant.key}
          member={variant}
          initialTimestamp="2026-07-10T10:00:00.000+09:00"
          disableTracking
        />
      ))}
    </div>
  );
}

const meta = {
  title: "Screens/Member/CertificationView",
  component: CertificationScreenStory,
  args: {
    displayName: "김싸피",
    campus: "서울",
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof CertificationScreenStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const certificationCard = canvas.getByTestId("certification-card-frame");
    const avatar = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-avatar]",
    );
    const footer = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-footer]",
    );
    const screenContent = canvas.getByTestId("certification-screen-content");
    const pageHeader = canvas.getByRole("banner");
    const backLink = canvas.getByRole("link", {
      name: "혜택 화면으로 돌아가기",
    });
    const qrButton = canvas.getByRole("button", { name: "QR 표시" });
    const cardTrigger = canvas.getByTestId("certification-card-frame");
    const memberName = canvas.getByRole("heading", { name: "김싸피" });
    const roleBadge = canvas.getByText("교육생", { selector: "span" });
    const footerLabel = canvas.getByText("인증 시간");
    const timestamp = canvas.getByText("2026. 07. 10. 10:00:00");
    const qrTouchTarget = canvasElement.querySelector<HTMLElement>(
      "[data-certification-qr-touch-target]",
    );
    const timestampRow = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-timestamp-row]",
    );
    const qrPseudoStyle = getComputedStyle(qrButton, "::after");
    const chipGroup = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-chip-group]",
    );
    const cardTitle = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-title]",
    );
    const chipBadges = chipGroup?.querySelectorAll<HTMLElement>("span") ?? [];

    await expect(certificationCard).toHaveClass(
      "w-full",
      "aspect-[16/9]",
      "rounded-[3cqw]",
      "@container/cert",
    );
    await expect(footer).toHaveClass(
      "h-[14cqw]",
      "px-[4cqw]",
      "py-[4cqw]",
    );
    await expect(qrButton).toHaveClass(
      "!h-[5.9cqw]",
      "!min-h-0",
      "!px-[2.1cqw]",
    );
    await expect(timestampRow).not.toBeNull();
    await expect(timestampRow).toHaveClass("items-center");
    await expect(certificationCard).not.toHaveClass("transform-gpu");
    await expect(certificationCard).not.toHaveClass("max-w-2xl");
    await expect(chipGroup).not.toBeNull();
    await expect(chipGroup).toHaveClass("gap-[1.6cqw]");
    await expect(cardTitle).not.toBeNull();
    await expect(cardTitle).toHaveClass("space-y-[1.8cqw]");
    await expect(chipGroup).toHaveTextContent("15기");
    await expect(chipGroup).toHaveTextContent("서울");
    await expect(chipGroup).toHaveTextContent("교육생");
    for (const chip of chipBadges) {
      await expect(chip).toHaveClass("!text-[2.4cqw]");
    }
    await expect(screenContent.getBoundingClientRect().width).toBe(
      pageHeader.getBoundingClientRect().width,
    );
    await expect(pageHeader.getBoundingClientRect().width).toBe(
      certificationCard.getBoundingClientRect().width,
    );
    const cardRect = certificationCard.getBoundingClientRect();
    const avatarRect = avatar?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();

    await expect(cardRect.width / cardRect.height).toBeCloseTo(16 / 9, 2);
    await expect(backLink.compareDocumentPosition(canvas.getByText("Member"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await expect(qrButton).toBeVisible();
    await expect(qrTouchTarget).not.toBeNull();
    await expect(qrTouchTarget).not.toHaveClass("min-h-11", "min-w-11");
    await expect(Number.parseFloat(qrPseudoStyle.minHeight)).toBeGreaterThanOrEqual(44);
    await expect(Number.parseFloat(qrPseudoStyle.minWidth)).toBeGreaterThanOrEqual(44);
    await expect(memberName).toHaveClass("text-[6cqw]");
    await expect(roleBadge).toHaveClass("!text-[2.4cqw]");
    await expect(
      Number.parseFloat(getComputedStyle(roleBadge).fontSize) /
        Number.parseFloat(getComputedStyle(memberName).fontSize),
    ).toBeCloseTo(0.4, 2);
    await expect(footerLabel).toHaveClass("text-[3cqw]");
    await expect(timestamp).toHaveClass("text-[3cqw]");
    await expect(canvas.queryByText("교육생 인증")).not.toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-certification-card-timestamp]")).not.toBeNull();
    await expect(qrButton).toHaveClass("text-[2.4cqw]");
    await expect(avatar).not.toBeNull();
    await expect(footer).not.toBeNull();
    const avatarRatio =
      (avatar?.getBoundingClientRect().width ?? 0) /
      certificationCard.getBoundingClientRect().width;
    await expect(avatarRatio).toBeGreaterThan(0.25);
    await expect(avatarRatio).toBeLessThan(0.28);
    await expect(footerRect?.top ?? 0).toBeGreaterThanOrEqual(
      (avatarRect?.bottom ?? 0) - 1,
    );
    await expect(footerRect?.bottom ?? 0).toBeLessThanOrEqual(
      cardRect.bottom + 1,
    );

    await userEvent.click(cardTrigger);
    const body = within(document.body);
    await expect(body.getByRole("dialog")).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "닫기" }));
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const RoleVariants: Story = {
  render: () => <CertificationRoleVariantsStory />,
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll<HTMLElement>(
      "[data-testid=certification-card-frame]",
    );

    await expect(cards).toHaveLength(3);
    for (const card of cards) {
      await expect(card).toHaveClass("aspect-[16/9]", "@container/cert");
      await expect(card.querySelector("[data-certification-card-avatar]")).not.toBeNull();
      await expect(card.querySelector("[data-certification-card-footer]")).not.toBeNull();
      await expect(card.querySelector("[data-certification-card-timestamp-row]")).not.toBeNull();
    }
  },
};

export const LongKorean: Story = {
  args: {
    displayName: "아주 긴 이름을 가진 서울 캠퍼스 구성원",
    campus: "서울 캠퍼스 역삼 멀티캠퍼스 교육장",
  },
  play: async ({ canvasElement }) => {
    const identity = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-identity]",
    );
    const footer = canvasElement.querySelector<HTMLElement>(
      "[data-certification-card-footer]",
    );

    await expect(identity).not.toBeNull();
    await expect(footer).not.toBeNull();
    await expect(identity?.scrollHeight).toBeLessThanOrEqual(
      identity?.clientHeight ?? 0,
    );
    await expect(identity?.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      footer?.getBoundingClientRect().top ?? 0,
    );
  },
};
