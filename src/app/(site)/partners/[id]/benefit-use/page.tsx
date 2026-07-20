import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import PartnerBenefitVerificationView from "@/components/partner/PartnerBenefitVerificationView";
import { getHeaderSession } from "@/lib/header-session";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";
import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { getMemberProfilePhotoAccessState } from "@/lib/member-profile-photo";
import { listCohortCardThemes } from "@/lib/cohort-card-themes";
import { getPartnerServiceMode } from "@/lib/partner-service-mode";
import { isPartnerBenefitUseAvailable, normalizePartnerBenefitSelection } from "@/lib/partner-benefit-usage";
import {
  partnerBenefitUsageRepository,
  partnerRepository,
} from "@/lib/repositories";
import { sanitizeReturnTo } from "@/lib/return-to";
import { SITE_NAME } from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";
import { getPartnerViewerContext } from "@/lib/partner-view-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `혜택 이용 확인 | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

function getPartnerPath(partnerId: string, returnTo: string) {
  const params = returnTo ? new URLSearchParams({ returnTo }) : null;
  return `/partners/${encodeURIComponent(partnerId)}${params ? `?${params}` : ""}`;
}

function getBenefitUsePath(
  partnerId: string,
  benefit: string,
  returnTo: string,
) {
  const params = new URLSearchParams({ benefit, returnTo });
  return `/partners/${encodeURIComponent(partnerId)}/benefit-use?${params}`;
}

export default async function PartnerBenefitUsePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    benefit?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const session = await getSignedUserSession();
  const resolvedParams = await params;
  const partnerId = decodeURIComponent(resolvedParams.id ?? "").trim();
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(resolvedSearchParams.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams.returnTo;
  const returnTo = sanitizeReturnTo(rawReturnTo, `/partners/${encodeURIComponent(partnerId)}`);
  const detailPath = getPartnerPath(partnerId, returnTo);
  const benefit = Array.isArray(resolvedSearchParams.benefit)
    ? resolvedSearchParams.benefit[0]
    : resolvedSearchParams.benefit;

  if (!session?.userId) {
    const requestedPath = benefit
      ? getBenefitUsePath(partnerId, benefit, returnTo)
      : detailPath;
    redirect(`/auth/login?returnTo=${encodeURIComponent(requestedPath)}`);
  }

  const viewerContext = await getPartnerViewerContext(session.userId);
  const partner = await partnerRepository.getPartnerById(partnerId, {
    authenticated: true,
    viewerAudience: viewerContext.viewerAudience,
  });
  if (
    !partner ||
    getPartnerServiceMode(partner.location) !== "offline" ||
    !isPartnerBenefitUseAvailable({
      location: partner.location,
      periodStart: partner.period.start,
      periodEnd: partner.period.end,
    })
  ) {
    redirect(detailPath);
  }

  const selectedBenefit = normalizePartnerBenefitSelection(partner.benefits, benefit);
  if (!selectedBenefit) {
    redirect(detailPath);
  }

  const [headerSession, member, cohortCardThemes, photoState, verificationContext] = await Promise.all([
    getHeaderSession(session.userId),
    getMemberCanonicalProfile(session.userId),
    listCohortCardThemes(),
    getMemberProfilePhotoState(session.userId),
    partnerBenefitUsageRepository.getVerificationContext(partner.id),
  ]);
  if (!member) {
    redirect(
      `/auth/login?returnTo=${encodeURIComponent(
        getBenefitUsePath(partnerId, selectedBenefit, returnTo),
      )}`,
    );
  }

  const photoAccess = getMemberProfilePhotoAccessState(photoState.reviewStatus);
  const profileImageUrl =
    !photoAccess.restrictCertification &&
    member.activeProfileImageId &&
    member.profilePhotoReviewStatus === "approved" &&
    !member.mustChangePassword
      ? "/api/certification/profile-image"
      : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <PageHeader
              eyebrow="Offline Benefit"
              title="혜택 이용 확인"
              description={
                verificationContext?.pinHash && verificationContext.pinSalt
                  ? "제휴처에서 싸트너십 인증 카드와 확인 PIN을 확인합니다."
                  : "제휴처에서 싸트너십 인증 카드와 선택한 혜택을 확인합니다."
              }
              backHref={detailPath}
              backLabel="제휴처로 돌아가기"
            />
            <PartnerBenefitVerificationView
              partnerId={partner.id}
              partnerName={partner.name}
              benefit={selectedBenefit}
              member={{
                mattermostUsername: member.mattermostUsername,
                displayName: member.displayName,
                generation: member.generation,
                campus: member.campus,
                graduateVerifiedAt: member.graduateVerifiedAt,
                profileImageUrl,
              }}
              cohortCardThemes={cohortCardThemes}
              initialTimestamp={new Date().toISOString()}
              pinConfigured={Boolean(
                verificationContext?.pinHash && verificationContext.pinSalt,
              )}
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
