import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import GraduateVerificationApplicationView from "@/components/graduate-verification/GraduateVerificationApplicationView";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `수료생 인증 | ${SITE_NAME}`,
  robots: { index: false, follow: true },
};

export default function GraduateSignupPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <GraduateVerificationApplicationView />
        </Container>
      </main>
    </div>
  );
}
