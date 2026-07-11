import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
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
          mm_username: "story-member",
          display_name: displayName,
          year: 15,
          campus,
          avatar_url: null,
        }}
        initialTimestamp="2026-07-10T10:00:00.000+09:00"
        disableTracking
      />
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
    const memberName = canvas.getByRole("heading", { name: "김싸피" });
    const roleBadge = canvas.getByText("교육생", { selector: "span" });
    const timestamp = canvas.getByText("2026. 07. 10. 10:00:00");
    const qrTouchTarget = canvasElement.querySelector<HTMLElement>(
      "[data-certification-qr-touch-target]",
    );
    const qrPseudoStyle = getComputedStyle(qrButton, "::after");

    await expect(certificationCard).toHaveClass(
      "w-full",
      "aspect-[1.58/1]",
      "@container/cert",
    );
    await expect(certificationCard).not.toHaveClass("max-w-2xl");
    await expect(screenContent.getBoundingClientRect().width).toBe(
      pageHeader.getBoundingClientRect().width,
    );
    await expect(pageHeader.getBoundingClientRect().width).toBe(
      certificationCard.getBoundingClientRect().width,
    );
    await expect(
      certificationCard.getBoundingClientRect().width /
        certificationCard.getBoundingClientRect().height,
    ).toBeCloseTo(1.58, 1);
    await expect(backLink.compareDocumentPosition(canvas.getByText("Member"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await expect(qrButton).toBeVisible();
    await expect(qrTouchTarget).not.toBeNull();
    await expect(
      qrTouchTarget?.getBoundingClientRect().height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await expect(Number.parseFloat(qrPseudoStyle.minHeight)).toBeGreaterThanOrEqual(44);
    await expect(Number.parseFloat(qrPseudoStyle.minWidth)).toBeGreaterThanOrEqual(44);
    await expect(Number.parseFloat(getComputedStyle(memberName).fontSize)).toBeGreaterThanOrEqual(16);
    await expect(Number.parseFloat(getComputedStyle(roleBadge).fontSize)).toBeGreaterThanOrEqual(10);
    await expect(Number.parseFloat(getComputedStyle(timestamp).fontSize)).toBeGreaterThanOrEqual(10);
    await expect(Number.parseFloat(getComputedStyle(qrButton).fontSize)).toBeGreaterThanOrEqual(10);
    await expect(avatar).not.toBeNull();
    await expect(footer).not.toBeNull();
    await expect(
      (avatar?.getBoundingClientRect().width ?? 0) /
        certificationCard.getBoundingClientRect().width,
    ).toBeCloseTo(0.34, 2);
    await expect(
      (footer?.getBoundingClientRect().height ?? 0) /
        certificationCard.getBoundingClientRect().width,
    ).toBeCloseTo(0.19, 2);
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
