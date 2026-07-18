import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberSignupApprovalDetail from "./AdminMemberSignupApprovalDetail";

const request = {
  id: "00000000-0000-4000-8000-000000000401",
  mmUserId: "00000000-0000-4000-8000-000000000402",
  mmUsername: "needs-manual-review",
  mattermostDisplayName: "닉네임 파싱 보완 필요 사용자",
  senderGeneration: 15,
  requestedGeneration: 15,
  parseExclusionReason: "campus_ambiguous" as const,
  status: "pending" as const,
  marketingPolicyChecked: true,
  consentAgreedAt: "2026-07-17T09:00:00.000Z",
  createdAt: "2026-07-17T09:00:00.000Z",
  updatedAt: "2026-07-17T09:00:00.000Z",
};

const noop = async () => undefined;

const meta = {
  title: "Domains/Admin/MemberSignupApprovalDetail",
  component: AdminMemberSignupApprovalDetail,
  args: {
    request,
    approveAction: noop,
    rejectAction: noop,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberSignupApprovalDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
