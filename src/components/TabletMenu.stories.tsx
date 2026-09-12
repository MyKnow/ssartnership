import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "next-themes";
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
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ToastProvider>
          <div className="min-h-[36rem] bg-background p-6">
            <Story />
          </div>
        </ToastProvider>
      </ThemeProvider>
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
    const menu = body.getByRole("dialog", { name: "메뉴" });
    await expect(menu).toBeVisible();
    const menuContent = within(menu);
    await expect(within(menuContent.getByRole("region", { name: "탐색" })).getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
    await expect(within(menuContent.getByRole("region", { name: "계정" })).getByRole("button", { name: "로그아웃" })).toBeVisible();
    const appSettings = within(menuContent.getByRole("region", { name: "앱·서비스" }));
    await userEvent.click(appSettings.getByRole("button", { name: "다크 모드" }));
    await expect(appSettings.getByRole("button", { name: "다크 모드" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(appSettings.getByRole("button", { name: "라이트 모드" }));
    await expect(body.getByRole("link", { name: "내 정보" })).toHaveAttribute(
      "href",
      "/certification",
    );
    await expect(body.getByRole("link", { name: "계정 설정" })).toHaveAttribute(
      "href",
      "/settings?returnTo=%2F",
    );
    await expect(body.queryByText("싸트너십")).not.toBeInTheDocument();
    await expect(body.queryByText("로그인, 회원가입, 프로필, 알림 관련 메뉴입니다.")).not.toBeInTheDocument();
    await expect(body.queryByText("앱", { exact: true })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menu).not.toBeVisible());
  },
};

export const GuestAccountGroup: Story = {
  args: { initialSession: null, guestAuthReturnTo: "/partners/health-001" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "메뉴 열기" }));
    const menu = within(document.body).getByRole("dialog", { name: "메뉴" });
    const account = within(within(menu).getByRole("region", { name: "계정" }));
    await expect(account.getByRole("link", { name: "쿠폰함" })).toHaveAttribute("href", "/auth/login?returnTo=%2Fcoupons");
    await expect(account.getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/auth/login?returnTo=%2Fcertification");
    await expect(account.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/auth/login?returnTo=%2Fpartners%2Fhealth-001");
    await expect(account.getByRole("link", { name: "회원가입" })).toHaveAttribute("href", "/auth/signup?returnTo=%2Fpartners%2Fhealth-001");
    await expect(account.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(menu).not.toBeVisible());
  },
};
