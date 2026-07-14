import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberProfilePhotoPanel from "./AdminMemberProfilePhotoPanel";

const noOp = async () => undefined;

const meta = {
  title: "Screens/Admin/MemberProfilePhotoPanel",
  component: AdminMemberProfilePhotoPanel,
  args: {
    memberId: "00000000-0000-4000-8000-000000000001",
    reviewStatus: "approved",
    pendingImageId: null,
    canUpdate: true,
    approveAction: noOp,
    rejectReplacementAction: noOp,
    rejectCurrentAction: noOp,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberProfilePhotoPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

export const Pending: Story = {
  args: {
    reviewStatus: "pending",
    pendingImageId: null,
  },
};

export const ReadOnly: Story = {
  args: {
    canUpdate: false,
    reviewStatus: "rejected",
  },
};
