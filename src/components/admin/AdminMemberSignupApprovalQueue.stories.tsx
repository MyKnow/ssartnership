import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import AdminMemberSignupApprovalQueue from "./AdminMemberSignupApprovalQueue";

const request = {
  id: "00000000-0000-4000-8000-000000000301",
  mmUserId: "00000000-0000-4000-8000-000000000302",
  mmUsername: "unparsed-member",
  mattermostDisplayName: "서울 캠퍼스에서 확인이 필요한 가입자",
  senderGeneration: 15,
  requestedGeneration: 15,
  parseExclusionReason: "display_name_not_person_like" as const,
  status: "pending" as const,
  marketingPolicyChecked: false,
  consentAgreedAt: "2026-07-17T09:00:00.000Z",
  createdAt: "2026-07-17T09:00:00.000Z",
  updatedAt: "2026-07-17T09:00:00.000Z",
};

const meta = {
  title: "Domains/Admin/MemberSignupApprovalQueue",
  component: AdminMemberSignupApprovalQueue,
  args: {
    requests: [request],
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberSignupApprovalQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { requests: [] },
};

export const Paginated: Story = {
  args: {
    pagination: {
      totalCount: 25,
      page: 2,
      pageSize: 12,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "이전" })).toHaveAttribute(
      "href",
      "/admin/member-signup-requests",
    );
    await expect(canvas.getByRole("link", { name: "다음" })).toHaveAttribute(
      "href",
      "/admin/member-signup-requests?page=3",
    );
    await expect(canvas.getByText("2 / 3")).toBeVisible();
  },
};
