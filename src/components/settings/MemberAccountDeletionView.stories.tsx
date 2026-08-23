import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import MemberAccountDeletionView from "@/components/settings/MemberAccountDeletionView";
import { ToastProvider } from "@/components/ui/Toast";

function StoryFrame() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <ToastProvider>
        <MemberAccountDeletionView settingsHref="/settings" />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Screens/Member/MemberAccountDeletionView",
  component: StoryFrame,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof StoryFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "회원 탈퇴 계속하기" }),
    );
    await expect(
      await dialog.findByRole("dialog", { name: "정말 탈퇴하시겠습니까?" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "회원 탈퇴" }),
    ).toBeVisible();
  },
};
