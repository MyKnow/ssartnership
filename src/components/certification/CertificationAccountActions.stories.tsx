import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import CertificationEmailAction from "@/components/certification/CertificationEmailAction";
import CertificationFooterActions from "@/components/certification/CertificationFooterActions";
import CertificationMattermostSyncAction from "@/components/certification/CertificationMattermostSyncAction";
import { ToastProvider } from "@/components/ui/Toast";

function CertificationAccountActionsStory({
  emailVerified = false,
}: {
  emailVerified?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <ToastProvider>
        <CertificationMattermostSyncAction />
        <CertificationEmailAction
          initialEmail={emailVerified ? "member@example.com" : null}
          emailVerified={emailVerified}
        />
        <CertificationFooterActions canChangeProfilePhoto />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Screens/Member/CertificationAccountActions",
  component: CertificationAccountActionsStory,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof CertificationAccountActionsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unverified: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByText(
        "비밀번호 변경 또는 회원 탈퇴를 진행할 수 있습니다. 탈퇴 후 30일이 지나면 개인 식별 정보와 프로필 사진이 익명화됩니다.",
      ),
    ).not.toBeInTheDocument();
  },
};

export const Verified: Story = {
  args: { emailVerified: true },
};
