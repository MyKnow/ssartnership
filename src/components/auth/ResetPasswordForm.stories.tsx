import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import ResetPasswordForm from "./ResetPasswordForm";

const meta = {
  title: "Domains/Auth/ResetPasswordForm",
  component: ResetPasswordForm,
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ResetPasswordForm>;

export default meta;

type Story = StoryObj<typeof meta>;

const issuer = "https://verify.myknow.xyz";

function installSsafyVerifyMock(callback: {
  code: string | null;
  error?: string | null;
  error_code?: string | null;
}) {
  window.ssafyVerify = {
    async verify() {
      return {
        code: callback.code,
        state: null,
        iss: issuer,
        error: callback.error ?? null,
        error_code: callback.error_code ?? null,
        request_id: "storybook-request",
        codeVerifier: "A".repeat(43),
      };
    },
  };
}

export const Default: Story = {};

export const SdkNotReady: Story = {
  play: async ({ canvasElement }) => {
    delete window.ssafyVerify;
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "SSAFY 인증으로 비밀번호 재설정" }),
    );
    await expect(
      canvas.getByText("SSAFY Verify를 불러오는 중입니다. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};

export const VerifyCancelled: Story = {
  play: async ({ canvasElement }) => {
    installSsafyVerifyMock({
      code: null,
      error: "access_denied",
      error_code: "VERIFY_CANCELLED",
    });
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "SSAFY 인증으로 비밀번호 재설정" }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "SSAFY 인증이 취소되었습니다.",
    );
  },
};

export const MemberNotFound: Story = {
  play: async ({ canvasElement }) => {
    installSsafyVerifyMock({ code: "0123456789abcdef" });
    window.fetch = async () =>
      Response.json(
        { ok: false, errorCode: "MEMBER_NOT_FOUND", requestId: null },
        { status: 404 },
      );
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "SSAFY 인증으로 비밀번호 재설정" }),
    );
    await expect(
      await canvas.findByText("SSAFY 인증과 연결된 회원 계정을 찾지 못했습니다."),
    ).toBeInTheDocument();
  },
};

export const RateLimited: Story = {
  play: async ({ canvasElement }) => {
    installSsafyVerifyMock({ code: "0123456789abcdef" });
    window.fetch = async () =>
      Response.json(
        { ok: false, errorCode: "VERIFY_RATE_LIMITED", requestId: null },
        { status: 429 },
      );
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: "SSAFY 인증으로 비밀번호 재설정" }),
    );
    await expect(
      await canvas.findByText("인증 요청이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};
