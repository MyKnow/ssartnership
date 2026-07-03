import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCompanyScopedPartnerServiceHref } from "@/lib/partner-portal-paths";
import { resolvePartnerPortalCompanyIdForService } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

type PartnerServiceDetailPageSearchParams = {
  mode?: string | string[];
  error?: string | string[];
  success?: string | string[];
};

function appendSearchParam(
  params: URLSearchParams,
  key: string,
  value?: string | string[],
) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized) {
    params.set(key, normalized);
  }
}

export const metadata: Metadata = {
  title: `브랜드 상세 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerServiceDetailCompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<PartnerServiceDetailPageSearchParams>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const { partnerId } = await params;
  const companyId = await resolvePartnerPortalCompanyIdForService(session, partnerId);
  if (!companyId) {
    notFound();
  }

  const paramsData = (await searchParams) ?? {};
  const nextParams = new URLSearchParams();
  appendSearchParam(nextParams, "mode", paramsData.mode);
  appendSearchParam(nextParams, "error", paramsData.error);
  appendSearchParam(nextParams, "success", paramsData.success);
  const queryString = nextParams.toString();
  redirect(
    `${getCompanyScopedPartnerServiceHref(companyId, partnerId)}${
      queryString ? `?${queryString}` : ""
    }`,
  );
}
