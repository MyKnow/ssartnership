import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";
import TabletMenu from "./TabletMenu";

const signedInSession: HeaderSession = {
  userId: "member-1",
  notificationUnreadCount: 4,
};

const meta = {
  title: "Domains/TabletMenu",
  component: TabletMenu,
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="min-h-[36rem] bg-background p-6">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof TabletMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignedInEscapeClose: Story = {
  args: {
    initialSession: signedInSession,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "메뉴 열기" }));

    const body = within(document.body);
    await expect(body.getByRole("dialog", { name: "메뉴" })).toBeVisible();
    await expect(body.getByRole("link", { name: "내 인증" })).toHaveAttribute(
      "href",
      "/certification",
    );
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog", { name: "메뉴" })).not.toBeInTheDocument();
  },
};
