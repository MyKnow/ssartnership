import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import SiteHeader from "@/components/SiteHeader";
import CouponWalletView from "@/components/coupons/CouponWalletView";
import CouponPartnerVerificationView from "@/components/coupons/CouponPartnerVerificationView";
import { adPackageRepository } from "@/lib/repositories";
import { SITE_NAME } from "@/lib/site";
import { getHeaderSession } from "@/lib/header-session";
import { getCertificationMemberView } from "@/lib/certification-member-view.server";
import { getSignedUserSession } from "@/lib/user-auth";
import { listCohortCardThemes } from "@/lib/cohort-card-themes.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `쿠폰함 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function CouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ issueId?: string | string[] }>;
}) {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent("/coupons")}`);
  }

  const [memberView, headerSession, coupons, params] = await Promise.all([
    getCertificationMemberView(session.userId),
    getHeaderSession(session.userId),
    adPackageRepository.listIssuedCouponsForMember({
      memberId: session.userId,
    }),
    searchParams ?? Promise.resolve<{ issueId?: string | string[] }>({}),
  ]);
  if (!memberView) {
    redirect(`/auth/login?returnTo=${encodeURIComponent("/coupons")}`);
  }

  const rawIssueId = Array.isArray(params.issueId) ? params.issueId[0] : params.issueId;
  const selectedItem = rawIssueId
    ? coupons.find((item) => item.issueId === rawIssueId && item.coupon.redemptionType === "onsite")
    : null;
  const cohortCardThemes = selectedItem ? await listCohortCardThemes() : [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          {selectedItem ? (
            <div className="mx-auto max-w-5xl">
              <CouponPartnerVerificationView
                item={selectedItem}
                member={memberView.member}
                cohortCardThemes={cohortCardThemes}
              />
            </div>
          ) : (
            <CouponWalletView coupons={coupons} />
          )}
        </Container>
      </main>
    </div>
  );
}
