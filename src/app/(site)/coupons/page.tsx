import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import SiteHeader from "@/components/SiteHeader";
import CouponWalletView from "@/components/coupons/CouponWalletView";
import { resolvePartnerAudienceFromMemberYear } from "@/lib/partner-audience";
import { isWithinPeriod } from "@/lib/partner-utils";
import { adPackageRepository, partnerRepository } from "@/lib/repositories";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getHeaderSession } from "@/lib/header-session";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `쿠폰함 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

type MemberRow = {
  year?: number | null;
  graduate_verified_at?: string | null;
};

function getVisiblePartnerIds(
  partners: Awaited<ReturnType<typeof partnerRepository.getPartners>>,
) {
  return partners
    .filter((partner) => partner.name)
    .filter((partner) => partner.visibility !== "private")
    .filter((partner) => !partner.benefitAccessStatus)
    .filter((partner) => isWithinPeriod(partner.period.start, partner.period.end))
    .map((partner) => partner.id);
}

export default async function CouponsPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent("/coupons")}`);
  }

  const supabase = getSupabaseAdminClient();
  const [{ data: member }, headerSession] = await Promise.all([
    supabase.from("members").select("year,graduate_verified_at").eq("id", session.userId).maybeSingle(),
    getHeaderSession(session.userId),
  ]);
  if (!member) {
    redirect(`/auth/login?returnTo=${encodeURIComponent("/coupons")}`);
  }

  const viewerAudience = resolvePartnerAudienceFromMemberYear(
    typeof (member as MemberRow).year === "number" ? (member as MemberRow).year : null,
    new Date(),
    undefined,
    { graduateVerifiedAt: (member as MemberRow).graduate_verified_at ?? null },
  );
  const partners = await partnerRepository.getPartners({
    authenticated: true,
    viewerAudience,
  });
  const partnerIds = getVisiblePartnerIds(partners);
  const coupons = await adPackageRepository.listAvailableCouponsForMember({
    memberId: session.userId,
    partnerIds,
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
