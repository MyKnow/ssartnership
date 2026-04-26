import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import LoginForm from "./LoginForm";

const meta = {
  title: "Domains/Auth/LoginForm",
  component: LoginForm,
  args: {
    returnTo: "/partners/partner-1",
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="mx-auto max-w-md">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithReturnToAdmin: Story = {
  args: {
    returnTo: "/admin",
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));
    await expect(canvas.getByText("아이디를 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("비밀번호를 입력해 주세요.")).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "bad id!");
    await userEvent.type(canvas.getByPlaceholderText("사이트 비밀번호"), "password123");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));
    await expect(canvas.getByText("아이디에 공백을 넣을 수 없습니다.")).toBeInTheDocument();
  },
};

export const BlockedLogin: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () =>
      Response.json({ error: "blocked" }, { status: 429 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.type(canvas.getByPlaceholderText("사이트 비밀번호"), "password123");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));

    await expect(
      await canvas.findByText("로그인이 너무 자주 시도되었습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};

export const InvalidCredentials: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () =>
      Response.json({ error: "invalid_credentials" }, { status: 401 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.type(canvas.getByPlaceholderText("사이트 비밀번호"), "wrong-password");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));

    await expect(
      await canvas.findByText("아이디 또는 비밀번호가 올바르지 않습니다."),
    ).toBeInTheDocument();
  },
};

export const SuccessfulLogin: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () => Response.json({ requiresConsent: false }, { status: 200 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.type(canvas.getByPlaceholderText("사이트 비밀번호"), "Valid!123");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));

    await expect(await canvas.findByText("로그인되었습니다.")).toBeInTheDocument();
  },
};

export const SuccessfulLoginRequiringConsent: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () => Response.json({ requiresConsent: true }, { status: 200 });
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "ssafy15");
    await userEvent.type(canvas.getByPlaceholderText("사이트 비밀번호"), "Valid!123");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));

    await expect(await canvas.findByText("로그인되었습니다.")).toBeInTheDocument();
  },
};
