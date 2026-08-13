import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import AppleWalletPassSection from "@/components/certification/AppleWalletPassSection";

const meta = {
  title: "Components/Certification/AppleWalletPassSection",
  component: AppleWalletPassSection,
  args: {
    initialStatus: "active",
    lastIssuedAt: "2026-08-11T09:30:00.000+09:00",
  },
  parameters: {
    layout: "padded",
    viewport: { defaultViewport: "mobile1" },
  },
  render: (args) => (
    <div className="mx-auto w-full max-w-4xl">
      <AppleWalletPassSection {...args} />
    </div>
  ),
} satisfies Meta<typeof AppleWalletPassSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RevokeConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "이 패스 폐기" }),
    );

    const dialog = within(document.body).getByRole("dialog", {
      name: "Apple Wallet 패스를 폐기할까요?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveTextContent(
      "기기에 남아 있는 패스의 QR도 즉시 인증되지 않습니다.",
    );
  },
};

export const RevokeCancel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "이 패스 폐기" }),
    );

    const dialog = within(document.body).getByRole("dialog", {
      name: "Apple Wallet 패스를 폐기할까요?",
    });

    await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    await expect(within(document.body).queryByRole("dialog")).toBeNull();
  },
};

export const RevokeSuccess: Story = {
  play: async ({ canvasElement }) => {
    const originalFetch = window.fetch;
    window.fetch = async (_input, init) => {
      if (init?.method === "DELETE") {
        return Response.json({ ok: true, alreadyRevoked: false });
      }
      return Response.json(
        { ok: false, message: "Unhandled story request" },
        { status: 500 },
      );
    };

    try {
      const canvas = within(canvasElement);
      await userEvent.click(
        canvas.getByRole("button", { name: "이 패스 폐기" }),
      );

      const dialog = within(document.body).getByRole("dialog", {
        name: "Apple Wallet 패스를 폐기할까요?",
      });
      await userEvent.click(
        within(dialog).getByRole("button", { name: "패스 폐기" }),
      );

      await expect(await canvas.findByText("처리 완료")).toBeInTheDocument();
      await expect(canvas.getByText("폐기됨")).toBeInTheDocument();
      await expect(within(document.body).queryByRole("dialog")).toBeNull();
    } finally {
      window.fetch = originalFetch;
    }
  },
};
