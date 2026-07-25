import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
import AdminTaskInboxView from "./AdminTaskInboxView";

const tasks =
  ADMIN_NAV_GROUPS.find((group) => group.label === "작업함")?.items.filter(
    (item) => item.href !== "/admin/tasks",
  ) ?? [];

const meta = {
  title: "Domains/Admin/AdminTaskInboxView",
  component: AdminTaskInboxView,
  args: {
    tasks,
    queueCounts: {
      "/admin/partner-registrations": 5,
      "/admin/partner-requests": 2,
      "/admin/notifications": 0,
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof AdminTaskInboxView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "작업함" })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /등록 신청/ })).toHaveAttribute(
      "href",
      "/admin/partner-registrations",
    );
    await expect(canvas.getByText("5건 대기")).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    tasks: [],
  },
};
