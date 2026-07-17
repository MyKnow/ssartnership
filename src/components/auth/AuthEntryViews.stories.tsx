import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  LoginPageView,
  ResetPasswordPageView,
  SignupPageView,
} from "@/components/auth/AuthEntryViews";

const meta = {
  title: "Screens/Auth/EntryViews",
  component: LoginPageView,
  args: {
    returnTo: "/#benefits",
  },
} satisfies Meta<typeof LoginPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const username = canvas.getByLabelText("아이디 또는 이메일");
    const password = canvas.getByLabelText("비밀번호");
    const autoLogin = canvas.getByRole("checkbox", { name: "자동 로그인" });
    const loginButton = canvas.getByRole("button", { name: "로그인" });
    const loginCard = canvas.getByTestId("password-login-card");
    const divider = canvas.getByRole("separator");
    const signupButton = canvas.getByRole("link", { name: "회원가입" });
    const orderedElements = [
      username,
      password,
      autoLogin,
      loginButton,
      divider,
      signupButton,
    ];

    await expect(
      canvas.queryByText("아이디와 사이트 비밀번호로 싸트너십에 로그인합니다."),
    ).not.toBeInTheDocument();
    await expect(signupButton).toHaveAttribute(
      "href",
      "/auth/signup?returnTo=%2F%23benefits",
    );
    await expect(loginCard).not.toContainElement(divider);

    for (let index = 0; index < orderedElements.length - 1; index += 1) {
      await expect(
        orderedElements[index].compareDocumentPosition(orderedElements[index + 1]),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  },
};

export const ResetPassword: Story = {
  render: () => <ResetPasswordPageView />,
};

export const Signup: Story = {
  render: (args) => <SignupPageView returnTo={args.returnTo} />,
};

export const SignupGraduate: Story = {
  render: (args) => <SignupPageView returnTo={args.returnTo} initialMethod="graduate" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "수료생" })).toHaveAttribute("aria-selected", "true");
    await expect(
      canvas.getByRole("link", { name: "수료생 신규 인증으로 시작하기" }),
    ).toBeVisible();
  },
};
