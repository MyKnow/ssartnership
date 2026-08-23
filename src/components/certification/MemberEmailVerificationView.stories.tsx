import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import MemberEmailVerificationView from "@/components/certification/MemberEmailVerificationView";
import PageHeader from "@/components/ui/PageHeader";
import { ToastProvider } from "@/components/ui/Toast";

function StoryFrame({
  emailVerified = false,
  initialEmail,
}: {
  emailVerified?: boolean;
  initialEmail?: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Member"
        title="로그인·복구 이메일"
        description="MM 사용 여부와 별개로, 계정 접근과 비밀번호 재설정에 사용할 이메일을 인증합니다."
        backHref="/certification"
        backLabel="내 인증으로 돌아가기"
      />
      <ToastProvider>
        <MemberEmailVerificationView
          initialEmail={
            initialEmail ?? (emailVerified ? "member@example.com" : null)
          }
          emailVerified={emailVerified}
          completionHref="/certification"
        />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Screens/Member/MemberEmailVerificationView",
  component: StoryFrame,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof StoryFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unverified: Story = {};

export const Verified: Story = {
  args: { emailVerified: true },
};

export const LongKorean: Story = {
  args: {
    emailVerified: true,
    initialEmail:
      "very-long-member-email-address-for-responsive-check@example-domain.com",
  },
};

export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "인증 코드 보내기" }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "이메일 주소를 확인해 주세요.",
    );
    await expect(canvas.getByLabelText("이메일")).toHaveFocus();
  },
};

export const CodeSent: Story = {
  play: async ({ canvasElement }) => {
    const originalFetch = window.fetch;
    window.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/member/email/send")) {
        return Response.json(
          {
            ok: true,
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            expiresInSeconds: 600,
            resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
            resendAvailableInSeconds: 60,
          },
          { status: 200 },
        );
      }
      return Response.json(
        { ok: false, message: `Unhandled story fetch: ${url}` },
        { status: 500 },
      );
    };

    try {
      const canvas = within(canvasElement);
      const emailInput = canvas.getByLabelText("이메일");
      await userEvent.type(emailInput, "member@example.com");
      await userEvent.click(
        canvas.getByRole("button", { name: "인증 코드 보내기" }),
      );

      await expect(
        await canvas.findByText("member@example.com"),
      ).toBeInTheDocument();
      await expect(canvas.queryByLabelText("이메일")).toBeNull();
      await expect(canvas.getByRole("timer")).toHaveTextContent(/09:5\d|10:00/);
      await expect(
        canvas.getByRole("button", { name: /후 재전송/ }),
      ).toBeDisabled();
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const Expired: Story = {
  play: async ({ canvasElement }) => {
    const originalFetch = window.fetch;
    window.fetch = async () =>
      Response.json(
        {
          ok: true,
          expiresInSeconds: 0.1,
          resendAvailableInSeconds: 0.1,
        },
        { status: 200 },
      );

    try {
      const canvas = within(canvasElement);
      await userEvent.type(canvas.getByLabelText("이메일"), "member@example.com");
      await userEvent.click(
        canvas.getByRole("button", { name: "인증 코드 보내기" }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 1_100));
      await expect(await canvas.findByText("인증 코드 만료")).toBeInTheDocument();
      await expect(canvas.getByRole("timer")).toHaveTextContent("00:00");
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const ServerError: Story = {
  play: async ({ canvasElement }) => {
    const originalFetch = window.fetch;
    window.fetch = async () =>
      Response.json(
        { ok: false, message: "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );

    try {
      const canvas = within(canvasElement);
      await userEvent.type(canvas.getByLabelText("이메일"), "member@example.com");
      await userEvent.click(
        canvas.getByRole("button", { name: "인증 코드 보내기" }),
      );
      await expect(await canvas.findByRole("alert")).toHaveTextContent(
        "인증 코드를 보내지 못했습니다.",
      );
    } finally {
      window.fetch = originalFetch;
    }
  },
};
