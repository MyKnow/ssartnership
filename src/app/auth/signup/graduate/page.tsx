import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import GraduateVerificationApplicationView from "@/components/graduate-verification/GraduateVerificationApplicationView";
import Container from "@/components/ui/Container";
import type { GraduateVerificationRequestKind } from "@/lib/graduate-verification";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `수료생 인증 | ${SITE_NAME}`,
  robots: { index: false, follow: true },
};

function getRequestKind(value: string | string[] | undefined): GraduateVerificationRequestKind {
  const kind = Array.isArray(value) ? value[0] : value;
  return kind === "recovery" ? "existing_member_recovery" : "graduate_signup";
}

export default async function GraduateSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestKind = getRequestKind(params.kind);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <GraduateVerificationApplicationView requestKind={requestKind} />
        </Container>
      </main>
    </div>
  );
}
