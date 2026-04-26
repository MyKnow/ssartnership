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

export const Default: Story = {};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(canvas.getByText("MM 아이디를 입력해 주세요.")).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "bad id!");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(canvas.getByText("MM 아이디에 공백을 넣을 수 없습니다.")).toBeInTheDocument();
  },
};

export const RequestCooldown: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () =>
      Response.json({ error: "cooldown" }, { status: 429 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(
      await canvas.findByText("인증번호 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};

export const VerifyInvalidCode: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/mm/reset-password")) {
        return Response.json({ ok: true });
      }
      return Response.json({ error: "invalid_code" }, { status: 400 });
    };
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(await canvas.findByPlaceholderText("예: A1B2C3")).toBeEnabled();

    await userEvent.click(canvas.getByRole("button", { name: "인증번호 확인" }));
    await expect(canvas.getByText("인증번호를 입력해 주세요.")).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText("예: A1B2C3"), "a1b2c3");
    await expect(canvas.getByPlaceholderText("예: A1B2C3")).toHaveValue("A1B2C3");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 확인" }));
    await expect(await canvas.findByText("인증번호가 올바르지 않습니다.")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "다시 입력" }));
    await expect(canvas.getByPlaceholderText("예: A1B2C3")).toHaveValue("");
  },
};

export const RequestBlocked: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () => Response.json({ error: "blocked" }, { status: 429 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(
      await canvas.findByText("인증번호 요청이 제한되었습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};

export const RequestNotRegistered: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () => Response.json({ error: "not_registered" }, { status: 404 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(await canvas.findByText("등록된 회원 정보가 없습니다.")).toBeInTheDocument();
  },
};

export const VerifyExpired: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/mm/reset-password")) {
        return Response.json({ ok: true });
      }
      return Response.json({ error: "expired" }, { status: 400 });
    };
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await userEvent.type(await canvas.findByPlaceholderText("예: A1B2C3"), "A1B2C3");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 확인" }));
    await expect(
      await canvas.findByText("인증번호가 만료되었습니다. 다시 발급해 주세요."),
    ).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("예: A1B2C3")).toHaveValue("");
  },
};

export const VerifyBlocked: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/mm/reset-password")) {
        return Response.json({ ok: true });
      }
      return Response.json({ error: "blocked" }, { status: 429 });
    };
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await userEvent.type(await canvas.findByPlaceholderText("예: A1B2C3"), "A1B2C3");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 확인" }));
    await expect(
      await canvas.findByText("인증번호 확인이 제한되었습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};

export const VerifyMissingCompletionToken: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/mm/reset-password")) {
        return Response.json({ ok: true });
      }
      return Response.json({}, { status: 200 });
    };
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await userEvent.type(await canvas.findByPlaceholderText("예: A1B2C3"), "A1B2C3");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 확인" }));
    await expect(await canvas.findByText("인증번호 확인에 실패했습니다.")).toBeInTheDocument();
  },
};

export const UsernameChangeResetsRequestedCode: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () => Response.json({ ok: true });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.click(canvas.getByRole("button", { name: "인증번호 발급" }));
    await expect(await canvas.findByPlaceholderText("예: A1B2C3")).toBeEnabled();
    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "new");
    await expect(canvas.getByPlaceholderText("예: A1B2C3")).toBeDisabled();
    await expect(canvas.getByPlaceholderText("예: A1B2C3")).toHaveValue("");
  },
};
