import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SsafyVerifyButton from "@/components/auth/SsafyVerifyButton";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import { sanitizeReturnTo } from "@/lib/return-to";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `SSAFY 인증 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SsafyAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const headerSession = await getHeaderSession();
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "/",
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">
              SSAFY 구성원 인증
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              SSAFY Verify를 통해 구성원 여부를 확인하고 싸트너십 계정에 연결합니다.
            </p>
            <SsafyVerifyButton returnTo={returnTo} />
          </Card>
        </Container>
      </main>
    </div>
  );
}
