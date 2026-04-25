import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminLogoutButton from "./AdminLogoutButton";

const meta = {
  title: "Domains/Admin/AdminLogoutButton",
  component: AdminLogoutButton,
  args: {
    action: async () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminLogoutButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FullWidth: Story = {
  args: {
    className: "w-full justify-center rounded-2xl",
  },
};
