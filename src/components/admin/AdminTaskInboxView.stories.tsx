import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ADMIN_NAV_GROUPS, getAdminTaskItems } from "./admin-navigation";
import AdminTaskInboxView, {
  AdminTaskInboxLoading,
} from "./AdminTaskInboxView";

const tasks = getAdminTaskItems(ADMIN_NAV_GROUPS);

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
    await expect(
      canvas.getByRole("heading", { name: "작업함" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: /등록 신청/ }),
    ).toHaveAttribute("href", "/admin/partner-registrations");
    await expect(canvas.getByText("2건 대기")).toBeInTheDocument();
    await expect(canvas.getByText("다음으로 처리")).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: /등록 신청.*5건 검토 시작/ }),
    ).toHaveAttribute("data-admin-task-source", "task_inbox_next");
  },
};

export const Empty: Story = {
  args: {
    tasks: [],
  },
};

export const Loading: Story = {
  render: () => <AdminTaskInboxLoading tasks={tasks} />,
};

export const QueueCountsUnavailable: Story = {
  args: {
    queueCounts: Object.fromEntries(
      tasks.map((task) => [task.href, null]),
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("대기 수를 확인하지 못했습니다."),
    ).toBeInTheDocument();
    await expect(canvas.queryByText("다음으로 처리")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: "다시 확인" }),
    ).toHaveAttribute("href", "/admin/tasks");
  },
};
