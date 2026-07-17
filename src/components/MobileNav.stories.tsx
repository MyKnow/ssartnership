import { useEffect } from "react";
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
    await expect(body.getByRole("link", { name: "내 인증" })).toHaveAttribute("href", "/certification");
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

function InstallPromptMobileNavStory() {
  useEffect(() => {
    const promptEvent = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    promptEvent.prompt = async () => {};
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(promptEvent);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return <MobileNav initialSession={signedInSession} />;
}

export const SignedInActions: Story = {
  render: () => <InstallPromptMobileNavStory />,
  play: async ({ canvasElement }) => {
    const originalConfirm = window.confirm;
    let confirmCalled = false;
    window.confirm = () => {
      confirmCalled = true;
      return false;
    };

    try {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "메뉴 열기" }));

      const body = within(document.body);
      const dialog = body.getByRole("dialog");
      const logoutButton = within(dialog).getByRole("button", { name: "로그아웃" });
      await userEvent.click(logoutButton);
      await expect(confirmCalled).toBe(true);
      await expect(logoutButton).toBeVisible();

      const installButton = await within(dialog).findByRole("button", { name: "앱 설치" });
      await userEvent.click(installButton);
      await expect(await body.findByText("설치가 시작되었습니다.")).toBeVisible();
    } finally {
      window.confirm = originalConfirm;
    }
  },
};
