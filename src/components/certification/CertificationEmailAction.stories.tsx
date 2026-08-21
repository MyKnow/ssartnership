import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import CertificationEmailAction from "@/components/certification/CertificationEmailAction";
import { ToastProvider } from "@/components/ui/Toast";

function CertificationEmailActionStory({ emailVerified = false }: { emailVerified?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <ToastProvider>
        <CertificationEmailAction
          initialEmail={emailVerified ? "member@example.com" : null}
          emailVerified={emailVerified}
        />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Components/Certification/EmailAction",
  component: CertificationEmailActionStory,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof CertificationEmailActionStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unverified: Story = {};

export const Verified: Story = {
  args: { emailVerified: true },
};

export const SendCodeSuccess: Story = {
  play: async ({ canvasElement }) => {
    const originalFetch = window.fetch;
    window.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/member/email/send")) {
        return Response.json({ ok: true }, { status: 200 });
      }
      return Response.json(
        { ok: false, message: `Unhandled story fetch: ${url}` },
        { status: 500 },
      );
    };

    try {
      const canvas = within(canvasElement);
      const emailInput = canvas.getByLabelText("이메일");
      const sendButton = canvas.getByRole("button", { name: "인증 코드 보내기" });

      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, "member@example.com");
      await userEvent.click(sendButton);

      await expect(await canvas.findByLabelText("6자리 인증 코드")).toBeInTheDocument();
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const VerifyCodeSuccess: Story = {
  play: async ({ canvasElement }) => {
    let sendCount = 0;
    let verifyCount = 0;

    const originalFetch = window.fetch;
    window.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/member/email/send")) {
        sendCount += 1;
        return Response.json({ ok: true }, { status: 200 });
      }
      if (url.includes("/api/member/email/verify")) {
        verifyCount += 1;
        return Response.json({ ok: true }, { status: 200 });
      }
      return Response.json(
        { ok: false, message: `Unhandled story fetch: ${url}` },
        { status: 500 },
      );
    };

    try {
      const canvas = within(canvasElement);
      const emailInput = canvas.getByLabelText("이메일");

      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, "member@example.com");
      await userEvent.click(canvas.getByRole("button", { name: "인증 코드 보내기" }));
      await userEvent.type(await canvas.findByLabelText("6자리 인증 코드"), "123456");
      await userEvent.click(canvas.getByRole("button", { name: "이메일 인증하기" }));

      await expect(sendCount).toBe(1);
      await expect(verifyCount).toBe(1);
      await expect(canvas.queryByLabelText("6자리 인증 코드")).toBeNull();
    } finally {
      window.fetch = originalFetch;
    }
  },
};
