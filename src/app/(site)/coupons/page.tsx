import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import SiteHeader from "@/components/SiteHeader";
import CouponWalletView from "@/components/coupons/CouponWalletView";
import { adPackageRepository } from "@/lib/repositories";
import { SITE_NAME } from "@/lib/site";
import { getHeaderSession } from "@/lib/header-session";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `쿠폰함 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function CouponsPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent("/coupons")}`);
  }

  const [member, headerSession] = await Promise.all([
    getMemberCanonicalProfile(session.userId),
    getHeaderSession(session.userId),
  ]);
  if (!member) {
    redirect(`/auth/login?returnTo=${encodeURIComponent("/coupons")}`);
  }

  const coupons = await adPackageRepository.listIssuedCouponsForMember({
    memberId: session.userId,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <CouponWalletView coupons={coupons} />
        </Container>
      </main>
    </div>
  );
}
