import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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

export const Login: Story = {};

export const ResetPassword: Story = {
  render: () => <ResetPasswordPageView />,
};

export const Signup: Story = {
  render: (args) => <SignupPageView returnTo={args.returnTo} />,
};
