import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminPaginationLink from "./AdminPaginationLink";

const meta = {
  title: "Domains/Admin/AdminPaginationLink",
  component: AdminPaginationLink,
  args: {
    href: "#page-2",
    children: "다음",
  },
} satisfies Meta<typeof AdminPaginationLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
