import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import SiteHeader from "@/components/SiteHeader";
import CouponWalletView from "@/components/coupons/CouponWalletView";
import CouponPartnerVerificationView from "@/components/coupons/CouponPartnerVerificationView";
import { adPackageRepository } from "@/lib/repositories";
import { SITE_NAME } from "@/lib/site";
import { getHeaderSession } from "@/lib/header-session";
import {
  getMemberCanonicalProfile,
  getMemberProfileImageUrl,
} from "@/lib/member-profile-view";
import { getSignedUserSession } from "@/lib/user-auth";
import { listCohortCardThemes } from "@/lib/cohort-card-themes";

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
  const params = (await searchParams) ?? {};
  const rawIssueId = Array.isArray(params.issueId) ? params.issueId[0] : params.issueId;
  const selectedItem = rawIssueId
    ? coupons.find((item) => item.issueId === rawIssueId && item.coupon.redemptionType === "onsite")
    : null;
  const cohortCardThemes = selectedItem ? await listCohortCardThemes() : [];
  const verificationMember = {
    mattermostUsername: member.mattermostUsername,
    displayName: member.displayName,
    generation: member.generation,
    campus: member.campus,
    graduateVerifiedAt: member.graduateVerifiedAt,
    profileImageUrl:
      member.activeProfileImageId &&
      member.profilePhotoReviewStatus === "approved" &&
      !member.mustChangePassword
        ? getMemberProfileImageUrl(member.id)
        : null,
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          {selectedItem ? (
            <div className="mx-auto max-w-5xl">
              <CouponPartnerVerificationView
                item={selectedItem}
                member={verificationMember}
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
