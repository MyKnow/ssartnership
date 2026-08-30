"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ThemeProvider } from "next-themes";
import Footer from "./Footer";
import { MobileNavSurface } from "./MobileNav";
import SiteHeader from "./SiteHeader";
import { ToastProvider } from "@/components/ui/Toast";
import type { HeaderSession } from "@/lib/header-session";

const signedInSession: HeaderSession = {
  userId: "member-1",
  notificationUnreadCount: 3,
};

function SiteHeaderStory(props: React.ComponentProps<typeof SiteHeader>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ToastProvider>
        <div className="min-h-[22rem] bg-background">
          <SiteHeader {...props} />
          <div className="ui-page-shell-wide pt-24">
            <div className="rounded-panel border border-border bg-surface-muted/60 p-6 text-sm text-muted-foreground">
              헤더 고정 영역과 본문 시작 간격을 함께 확인하기 위한 더미 본문입니다.
            </div>
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

function SiteNavigationStory(props: React.ComponentProps<typeof SiteHeader>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ToastProvider>
        <div className="min-h-screen bg-background">
          <MobileNavSurface signedInUserId={props.initialSession?.userId ?? null} />
          <SiteHeader {...props} />
          <main className="ui-page-shell-wide min-h-[32rem] py-8">
            <div className="rounded-panel border border-border bg-surface-muted/60 p-6 text-sm text-muted-foreground">
              상단 헤더와 하단 탐색이 함께 보이는 반응형 셸입니다.
            </div>
          </main>
          <Footer />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

const meta = {
  title: "Domains/SiteHeader",
  component: SiteHeaderStory,
  args: {
    suggestHref: "/suggest",
    initialSession: null,
  },
} satisfies Meta<typeof SiteHeaderStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {};

export const SignedIn: Story = {
  args: {
    initialSession: signedInSession,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "앱 설치" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "설정" })).toHaveAttribute(
      "href",
      "/settings?returnTo=%2F",
    );
    if (window.innerWidth < 768) {
      await expect(canvas.getByRole("link", { name: "알림" })).toBeVisible();
      await expect(canvas.queryByRole("button", { name: "테마 변경" })).not.toBeInTheDocument();
      return;
    }
    if (window.innerWidth < 1280) {
      await expect(
        await canvas.findByRole("link", { name: "내 인증" }),
      ).toHaveAttribute("href", "/certification");
    }
    await expect(canvas.getByRole("button", { name: "테마 변경" })).toBeVisible();
  },
};

export const WithMobileNavigation: Story = {
  args: {
    initialSession: signedInSession,
  },
  render: (args) => <SiteNavigationStory {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const footer = within(canvas.getByRole("contentinfo"));

    await expect(
      canvas.getByRole("button", { name: "테마 변경" }),
    ).toBeVisible();
    if (window.innerWidth < 768) {
      await expect(
        footer.queryByRole("button", { name: "라이트 모드" }),
      ).not.toBeInTheDocument();
      await expect(
        footer.queryByRole("link", { name: "알림센터" }),
      ).not.toBeInTheDocument();
      return;
    }

    await expect(
      footer.getByRole("button", { name: "라이트 모드" }),
    ).toBeVisible();
    await expect(footer.getByRole("link", { name: "알림센터" })).toBeVisible();
  },
};

export const FocusedEmailVerification: Story = {
  args: {
    initialSession: signedInSession,
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/certification/email" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("link", { name: "설정" })).not.toBeInTheDocument();
  },
};
