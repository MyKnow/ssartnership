import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SuggestPageView from "@/components/suggest/SuggestPageView";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `제휴 제안하기 | ${SITE_NAME}`,
  description: `${SITE_NAME}에 SSAFY 제휴 제안을 남겨주세요.`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SuggestPage() {
  const headerSession = await getHeaderSession();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader suggestHref="/suggest" initialSession={headerSession} />
      <SuggestPageView />
    </div>
  );
}
