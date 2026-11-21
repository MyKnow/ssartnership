import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { LoginPageView } from "@/components/auth/AuthEntryViews";
import { getHeaderSession } from "@/lib/header-session";
import { resolveMemberAuthDestination } from "@/lib/member-required-gates";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";
import { getSignedUserSession } from "@/lib/user-auth";

export const metadata: Metadata = {
  title: `로그인 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo: rawReturnTo } = await searchParams;
  const requestedReturnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  // Like the partner portal login, a member who is already signed in skips
  // the form. The DB-validated session (not just the cookie signature) is
  // required so a revoked cookie cannot bounce between login and returnTo.
  if ((await getSignedUserSession().catch(() => null))?.userId) {
    redirect(resolveMemberAuthDestination(requestedReturnTo, "/"));
  }
  const headerSession = await getHeaderSession();
  const returnTo = sanitizeReturnTo(requestedReturnTo, "/");
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        initialSession={headerSession}
        guestAuthReturnTo={rawReturnTo === undefined ? undefined : returnTo}
      />
      <LoginPageView returnTo={returnTo} />
    </div>
  );
}
