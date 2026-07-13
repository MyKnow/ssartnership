import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { SignupPageView } from "@/components/auth/AuthEntryViews";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";

export const metadata: Metadata = {
  title: `회원가입 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SignupPage({
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
      <SignupPageView returnTo={returnTo} />
    </div>
  );
}
