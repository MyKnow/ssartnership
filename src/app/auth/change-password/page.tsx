import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import { getUserSession } from "@/lib/user-auth";
import { getHeaderSession } from "@/lib/header-session";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";

type PageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export const metadata: Metadata = {
  title: `비밀번호 변경 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({ searchParams }: PageProps) {
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "",
  );
  const session = await getUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }
  if (session.requiresConsent) {
    const consentReturnTo = returnTo
      ? `/auth/consent?returnTo=${encodeURIComponent(returnTo)}`
      : "/auth/consent";
    redirect(consentReturnTo);
  }

  const headerSession = await getHeaderSession(session.userId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">
              비밀번호 변경
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              보안을 위해 새로운 비밀번호로 변경해 주세요.
            </p>
            <ChangePasswordForm returnTo={returnTo} />
          </Card>
        </Container>
      </main>
    </div>
  );
}
