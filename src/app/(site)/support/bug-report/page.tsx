import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import BugReportView from "@/components/support/BugReportView";
import { getHeaderSession } from "@/lib/header-session";
import { BUG_REPORT_TEMPLATE } from "@/lib/support-mail";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `버그 제보 | ${SITE_NAME}`,
  description: `${SITE_NAME} 이용 중 발견한 문제를 제보해 주세요.`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function BugReportPage() {
  const headerSession = await getHeaderSession();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <BugReportView template={BUG_REPORT_TEMPLATE} />
    </div>
  );
}
