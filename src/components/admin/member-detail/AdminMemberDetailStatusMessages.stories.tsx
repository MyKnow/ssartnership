import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberDetailStatusMessages from "./AdminMemberDetailStatusMessages";

const meta = {
  title: "Domains/Admin/MemberDetail/StatusMessages",
  component: AdminMemberDetailStatusMessages,
  args: {
    errorCode: "member_sync_identity_mismatch",
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberDetailStatusMessages>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ProfileSyncIdentityMismatch: Story = {};

export const ProviderAccessDenied: Story = {
  args: {
    errorCode: "member_sync_provider_access_denied",
  },
};
