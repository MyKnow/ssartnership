import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import AdminPartnerPreviewLinkPanel from "./AdminPartnerPreviewLinkPanel";

const meta = {
  title: "Admin/Partners/AdminPartnerPreviewLinkPanel",
  component: AdminPartnerPreviewLinkPanel,
  args: {
    partnerId: "11111111-1111-4111-8111-111111111111",
    hasActiveLink: false,
    generateAction: async () => ({
      previewUrl: "https://ssartnership.example/partners/partner-1?preview=token",
    }),
    removeAction: async () => undefined,
  },
} satisfies Meta<typeof AdminPartnerPreviewLinkPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "링크 생성" }));
    await expect(canvas.getByLabelText("현재 링크")).toHaveValue(
      "https://ssartnership.example/partners/partner-1?preview=token",
    );
    await expect(canvas.getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  },
};

export const ExistingLinkNotRevealed: Story = {
  args: {
    hasActiveLink: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("현재 발급된 링크가 있습니다. 이전 발급 링크는 보안상 다시 표시할 수 없으므로 새 링크를 생성해 주세요."),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "새 링크 생성" })).toBeInTheDocument();
  },
};

export const ExistingLink: Story = {
  args: {
    hasActiveLink: true,
    initialPreviewUrl: "https://ssartnership.example/partners/partner-1?preview=stored-token",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("현재 링크")).toHaveValue(
      "https://ssartnership.example/partners/partner-1?preview=stored-token",
    );
    await expect(canvas.getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  },
};
