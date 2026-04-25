import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
