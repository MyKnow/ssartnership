import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";
import UserMenu from "./UserMenu";

const signedInSession: HeaderSession = {
  userId: "member-1",
  notificationUnreadCount: 2,
};

const meta = {
  title: "Domains/Auth/UserMenu",
  component: UserMenu,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof UserMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {
  args: {
    initialSession: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/auth/login");
    await expect(canvas.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/auth/signup");
  },
};

export const SignedInCancelLogout: Story = {
  args: {
    initialSession: signedInSession,
  },
  play: async ({ canvasElement }) => {
    const originalConfirm = window.confirm;
    window.confirm = () => false;
    window.fetch = async () => Response.json({ ok: true });

    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "내 프로필 조회" })).toHaveAttribute("href", "/certification");
    await userEvent.click(canvas.getByRole("button", { name: "로그아웃" }));
    await expect(canvas.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();

    window.confirm = originalConfirm;
  },
};

export const SignedInConfirmLogout: Story = {
  args: {
    initialSession: signedInSession,
  },
  play: async ({ canvasElement }) => {
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    window.fetch = async () => Response.json({ ok: true });

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "로그아웃" }));
    await expect(await canvas.findByRole("link", { name: "로그인" })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "회원가입" })).toBeInTheDocument();

    window.confirm = originalConfirm;
  },
};

export const IconLogout: Story = {
  args: {
    initialSession: signedInSession,
    logoutIconOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "로그아웃" })).toHaveAttribute("title", "로그아웃");
  },
};
