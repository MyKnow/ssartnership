import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import PwaInstallGuideView from "@/components/pwa/PwaInstallGuideView";
import { getHeaderSession } from "@/lib/header-session";
import { parsePwaInstallPlatform } from "@/lib/pwa-install";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `앱 설치 | ${SITE_NAME}`,
  description: `${SITE_NAME}을 Android, iPhone, iPad 또는 데스크톱 홈 화면에 설치하는 방법을 확인하세요.`,
};

export default async function PwaInstallGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string | string[] }>;
}) {
  const [headerSession, query] = await Promise.all([
    getHeaderSession(),
    searchParams,
  ]);
  const platform = parsePwaInstallPlatform(query.platform);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <PwaInstallGuideView platform={platform} />
    </div>
  );
}
