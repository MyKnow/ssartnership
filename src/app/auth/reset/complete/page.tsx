import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ResetPasswordCompleteForm from "@/components/auth/ResetPasswordCompleteForm";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { verifyResetPasswordCompletionToken } from "@/lib/reset-password-session";

export const metadata: Metadata = {
  title: `새 비밀번호 설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const payload = token ? verifyResetPasswordCompletionToken(token) : null;
  const headerSession = await getHeaderSession();

  if (!payload) {
    redirect("/auth/reset");
  }

  return (
    <div className="bg-background">
      <SiteHeader initialSession={headerSession} />
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-2xl">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                새 비밀번호 설정
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                인증이 확인된 계정 {payload.mmUsername}의 새 비밀번호를 설정합니다.
              </p>
            </div>

            <ResetPasswordCompleteForm
              token={token}
              mmUsername={payload.mmUsername}
            />
          </Card>
        </div>
      </Container>
    </div>
  );
}
