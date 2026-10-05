import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import PwaInstallGuideView from "@/components/pwa/PwaInstallGuideView";
import { getHeaderSession } from "@/lib/header-session";
import { parsePwaInstallPlatform } from "@/lib/pwa-install";
import { createCanonicalAlternates, createPageOpenGraph } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

const INSTALL_PATH = "/install";
const INSTALL_TITLE = `앱 설치 | ${SITE_NAME}`;
const INSTALL_DESCRIPTION = `${SITE_NAME}을 Android, iPhone, iPad 또는 데스크톱 홈 화면에 설치하는 방법을 확인하세요.`;

export const metadata: Metadata = {
  title: INSTALL_TITLE,
  description: INSTALL_DESCRIPTION,
  // The platform query only switches the visible guide tab.
  alternates: createCanonicalAlternates(INSTALL_PATH),
  openGraph: createPageOpenGraph({
    path: INSTALL_PATH,
    title: INSTALL_TITLE,
    description: INSTALL_DESCRIPTION,
  }),
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
