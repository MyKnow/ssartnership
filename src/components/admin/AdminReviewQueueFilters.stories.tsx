import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminReviewQueueFilters from "./AdminReviewQueueFilters";

const meta = {
  title: "Domains/Admin/ReviewQueueFilters",
  component: AdminReviewQueueFilters,
  args: {
    options: [
      { value: "pending", label: "접수" },
      { value: "in_review", label: "검토 중" },
      { value: "converted", label: "등록 완료" },
    ],
    value: "pending",
    getHref: (value) =>
      value ? `/admin/partner-registrations?status=${value}` : "/admin/partner-registrations",
    ariaLabel: "검토 상태 필터",
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminReviewQueueFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "접수" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "전체" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const AllState: Story = {
  args: { value: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "전체" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};
