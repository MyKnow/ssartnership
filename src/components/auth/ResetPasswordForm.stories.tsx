import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
