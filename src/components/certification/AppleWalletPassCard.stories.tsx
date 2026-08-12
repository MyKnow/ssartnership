import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import AppleWalletPassCard from "@/components/certification/AppleWalletPassCard";

const meta = {
  title: "Components/Certification/AppleWalletPassCard",
  component: AppleWalletPassCard,
  args: {
    status: "not_issued",
    lastIssuedAt: "2026-08-11T09:30:00.000+09:00",
    blockerMessage: null,
    pendingAction: null,
    onIssue: fn(),
    onDownload: fn(),
    onRevoke: fn(),
  },
  parameters: {
    layout: "padded",
    viewport: { defaultViewport: "mobile1" },
  },
  render: (args) => (
    <div className="mx-auto w-full max-w-4xl">
      <AppleWalletPassCard {...args} />
    </div>
  ),
} satisfies Meta<typeof AppleWalletPassCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotIssued: Story = {
  args: {
    status: "not_issued",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const issueButton = canvas.getByRole("button", {
      name: "Apple Wallet 패스 발급하기",
    });
    const checkbox = canvas.getByRole("checkbox", {
      name: "개인정보 저장 내용을 확인했고 Apple Wallet 패스 발급에 동의합니다.",
    });

    await expect(issueButton).toBeDisabled();
    await userEvent.click(checkbox);
    const officialIssueButton = canvas.getByRole("button", {
      name: "Apple Wallet 패스 발급하기",
    });
    await expect(officialIssueButton).toBeEnabled();
    await userEvent.click(officialIssueButton);
    await expect(args.onIssue).toHaveBeenCalled();
  },
};

export const Active: Story = {
  args: {
    status: "active",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const downloadButton = canvas.getByRole("button", { name: "패스 다시 받기" });
    const revokeButton = canvas.getByRole("button", { name: "패스 폐기" });

    await expect(downloadButton).toBeEnabled();
    await expect(revokeButton).toBeEnabled();
    await userEvent.click(downloadButton);
    await userEvent.click(revokeButton);
    await expect(args.onDownload).toHaveBeenCalled();
    await expect(args.onRevoke).toHaveBeenCalled();
  },
};

export const ActiveIssuanceUnavailable: Story = {
  args: {
    status: "active_unavailable",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const downloadButton = canvas.getByRole("button", {
      name: "패스 다시 받기 중단",
    });
    const revokeButton = canvas.getByRole("button", { name: "패스 폐기" });

    await expect(downloadButton).toBeDisabled();
    await expect(revokeButton).toBeEnabled();
    await userEvent.click(downloadButton);
    await userEvent.click(revokeButton);
    await expect(args.onDownload).not.toHaveBeenCalled();
    await expect(args.onRevoke).toHaveBeenCalled();
  },
};

export const ConsentRequired: Story = {
  args: {
    status: "consent_required",
  },
};

export const Revoked: Story = {
  args: {
    status: "revoked",
  },
};

export const Blocked: Story = {
  args: {
    status: "blocked",
    blockerMessage: "본인 사진 검토가 완료되어야 Apple Wallet 패스를 발급할 수 있어요.",
    onIssue: undefined,
  },
};

export const ErrorState: Story = {
  args: {
    status: "error",
    blockerMessage: "패스 발급 서버와 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
  },
};

export const Unavailable: Story = {
  args: {
    status: "unavailable",
    onIssue: undefined,
  },
};

export const LongKoreanDesktop: Story = {
  args: {
    status: "revoked",
    blockerMessage:
      "운영 정책 변경으로 기존 패스가 회수되었어요. 최신 기수와 캠퍼스 정보가 반영된 새 패스를 다시 받아 주세요.",
  },
  parameters: {
    viewport: { defaultViewport: "desktop" },
  },
};

export const ViewportGallery: Story = {
  render: () => (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">360px</h2>
        <div className="w-[360px] max-w-full px-6">
          <AppleWalletPassCard status="not_issued" onIssue={fn()} />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">820px</h2>
        <div className="w-[820px] max-w-full px-9">
          <AppleWalletPassCard
            status="active"
            lastIssuedAt="2026-08-11T09:30:00.000+09:00"
            onDownload={fn()}
            onRevoke={fn()}
          />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">1366px</h2>
        <div className="w-[1366px] px-[235px]">
          <AppleWalletPassCard status="unavailable" />
        </div>
      </section>
    </div>
  ),
};
