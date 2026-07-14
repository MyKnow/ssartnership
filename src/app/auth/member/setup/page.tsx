import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import ManualMemberPasswordSetupView from "@/components/member-manual-import/ManualMemberPasswordSetupView";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `계정 비밀번호 설정 | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export default function ManualMemberSetupPage() {
  return <div className="min-h-screen bg-background"><SiteHeader /><main><Container className="pb-16 pt-10"><ManualMemberPasswordSetupView /></Container></main></div>;
}
