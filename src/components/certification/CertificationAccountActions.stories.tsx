import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import MemberSettingsView from "@/components/settings/MemberSettingsView";
import { ToastProvider } from "@/components/ui/Toast";

function MemberSettingsViewStory({
  emailVerified = false,
}: {
  emailVerified?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ToastProvider>
        <MemberSettingsView
          hasMattermostAccount
          email={emailVerified ? "member@example.com" : null}
          emailVerified={emailVerified}
          backHref="/certification"
          returnTo="/settings?returnTo=%2Fcertification"
        />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Screens/Member/MemberSettingsView",
  component: MemberSettingsViewStory,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof MemberSettingsViewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unverified: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "설정" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "연결 정보" }),
    ).toBeVisible();
    await expect(canvas.getByRole("region", { name: "보안" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "계정" })).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: /로그인·복구 이메일/ }),
    ).toHaveAttribute(
      "href",
      "/certification/email?returnTo=%2Fsettings%3FreturnTo%3D%252Fcertification",
    );
    await expect(canvas.getByRole("link", { name: /본인 사진/ })).toHaveAttribute(
      "href",
      "/certification/photo?returnTo=%2Fsettings%3FreturnTo%3D%252Fcertification",
    );
    await expect(
      canvas.getByRole("link", { name: /^비밀번호 현재/ }),
    ).toHaveAttribute(
      "href",
      "/auth/change-password?returnTo=%2Fsettings%3FreturnTo%3D%252Fcertification",
    );
  },
};

export const Verified: Story = {
  args: { emailVerified: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("member@example.com")).toBeVisible();
    await expect(
      canvas.queryByText(
        "MM 사용이 어려울 때 로그인과 비밀번호 재설정에 사용할 수 있습니다.",
      ),
    ).toBeNull();
    await expect(
      canvas.getByText("MM에서 현재 이름, 아이디, 트랙, 프로필 사진을 가져옵니다."),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: /^비밀번호 현재 계정의 비밀번호/ }),
    ).toBeVisible();
  },
};
