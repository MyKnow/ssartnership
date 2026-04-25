"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ThemeProvider } from "next-themes";
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
};
