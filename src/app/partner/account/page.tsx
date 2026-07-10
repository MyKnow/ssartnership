import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PartnerAccountScreen from "@/components/partner/PartnerAccountScreen";
import {
  archivePartnerBillingProfileAction,
  createPartnerBillingProfileAction,
  setDefaultPartnerBillingProfileAction,
} from "@/app/partner/account/actions";
import { getPartnerBillingProfiles } from "@/lib/partner-billing-profiles";
import { getPartnerBillingActionErrorMessage } from "@/lib/partner-billing-action-errors";
import { getPartnerPasswordChangeHref } from "@/lib/partner-portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `계정 | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function readSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{
    companyId?: string | string[];
    status?: string | string[];
    error?: string | string[];
  }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(null));
  }

  const companies = await getPartnerPortalCompanySummaries(session.companyIds);
  if (companies.length === 0) {
    redirect("/partner");
  }

  const params = (await searchParams) ?? {};
  const requestedCompanyId = readSearchParam(params.companyId)?.trim();
  const contextCompany =
    companies.find((company) => company.id === requestedCompanyId) ?? companies[0];
  if (!contextCompany) {
    redirect("/partner");
  }

  const profileGroups = await Promise.all(
    companies.map((company) =>
      getPartnerBillingProfiles({
        accountId: session.accountId,
        companyId: company.id,
      }),
    ),
  );
  const profiles = [
    ...new Map(
      profileGroups.flat().map((profile) => [profile.id, profile] as const),
    ).values(),
  ];
  const status = readSearchParam(params.status);
  const statusMessage =
    status === "created"
      ? "프로필이 저장되었습니다."
      : status === "defaulted"
        ? "기본 증빙 프로필이 변경되었습니다."
        : status === "archived"
          ? "증빙 프로필이 삭제되었습니다."
          : null;
  const errorMessage = getPartnerBillingActionErrorMessage(
    readSearchParam(params.error),
  );

  return (
    <PartnerAccountScreen
      companyId={contextCompany.id}
      displayName={session.displayName}
      loginId={session.loginId}
      profiles={profiles}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      actions={{
        createProfile: createPartnerBillingProfileAction,
        setDefaultProfile: setDefaultPartnerBillingProfileAction,
        archiveProfile: archivePartnerBillingProfileAction,
      }}
    />
  );
}
