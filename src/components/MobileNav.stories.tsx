import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";
import MobileNav from "./MobileNav";

const signedInSession: HeaderSession = {
  userId: "member-1",
  notificationUnreadCount: 4,
};

const meta = {
  title: "Domains/MobileNav",
  component: MobileNav,
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="min-h-[24rem] bg-background p-4">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof MobileNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {
  args: {
    initialSession: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "메뉴 열기" }));

    const body = within(document.body);
    await expect(body.getByRole("dialog")).toBeInTheDocument();
    await expect(body.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/auth/login");
    await expect(body.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/auth/signup");

    await userEvent.click(body.getAllByRole("button", { name: "메뉴 닫기" })[0]!);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const SignedInEscapeClose: Story = {
  args: {
    initialSession: signedInSession,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "메뉴 열기" }));

    const body = within(document.body);
    await expect(body.getByRole("link", { name: "내 프로필 조회" })).toHaveAttribute("href", "/certification");
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
