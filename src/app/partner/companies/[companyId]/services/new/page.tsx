import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerServiceNewScreen from "@/components/partner/PartnerServiceNewScreen";
import { createPartnerPortalBrandRegistrationRequestAction } from "@/app/partner/companies/[companyId]/services/new/actions";
import { getPartnerPasswordChangeHref } from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `제휴처 추가 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

async function getPartnerAccountEmail(accountId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("partner_accounts")
    .select("email")
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    return "";
  }
  return typeof data?.email === "string" ? data.email : "";
}

export default async function PartnerCompanyServiceNewPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(companyId));
  }

  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    notFound();
  }

  const [categoriesResult, brandProfilesResult, accountEmail] = await Promise.all([
    getSupabaseAdminClient()
      .from("categories")
      .select("id,key,label")
      .order("created_at", { ascending: true }),
    getSupabaseAdminClient()
      .from("partner_brand_profiles")
      .select("id,name,category_label,description,inquiry_link,brand_phone")
      .eq("company_id", scope.id)
      .order("updated_at", { ascending: false })
      .limit(30),
    getPartnerAccountEmail(session.accountId),
  ]);
  if (categoriesResult.error) {
    throw new Error(`category load failed: ${categoriesResult.error.message}`);
  }
  if (brandProfilesResult.error) {
    throw new Error(`brand profile load failed: ${brandProfilesResult.error.message}`);
  }

  const fallbackEmail = session.loginId.includes("@") ? session.loginId : "";

  return (
    <PartnerServiceNewScreen
      companyId={scope.id}
      companyName={scope.name}
      companyDescription={scope.description}
      displayName={session.displayName}
      contactEmail={accountEmail || fallbackEmail}
      categories={categoriesResult.data ?? []}
      brandProfiles={(brandProfilesResult.data ?? []).map((profile) => ({
        id: profile.id,
        name: profile.name,
        categoryLabel: profile.category_label,
        detailDescription: profile.description,
        inquiryLink: profile.inquiry_link,
        brandPhone: profile.brand_phone,
      }))}
      webAction={createPartnerPortalBrandRegistrationRequestAction}
    />
  );
}
