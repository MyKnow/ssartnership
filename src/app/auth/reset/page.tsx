import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { ResetPasswordPageView } from "@/components/auth/AuthEntryViews";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `비밀번호 재설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function ResetPasswordPage() {
  const headerSession = await getHeaderSession();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <ResetPasswordPageView />
    </div>
  );
}
