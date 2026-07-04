import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerRegistrationClient from "@/components/partner-registration/PartnerRegistrationClient";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
import { createPartnerPortalBrandRegistrationRequestAction } from "@/app/partner/companies/[companyId]/services/new/actions";
import {
  getCompanyScopedPortalHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `브랜드 추가 | ${SITE_NAME}`,
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

  const [categoriesResult, accountEmail] = await Promise.all([
    getSupabaseAdminClient()
      .from("categories")
      .select("id,key,label")
      .order("created_at", { ascending: true }),
    getPartnerAccountEmail(session.accountId),
  ]);
  if (categoriesResult.error) {
    throw new Error(`category load failed: ${categoriesResult.error.message}`);
  }

  const fallbackEmail = session.loginId.includes("@") ? session.loginId : "";

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-6 lg:pt-8">
        <div className="mx-auto grid max-w-6xl min-w-0 gap-5">
          <ShellHeader
            eyebrow="Partner Portal"
            title="브랜드 추가"
            description={`${scope.name}에 연결할 새 브랜드 또는 지점을 신청합니다. 제출 후 관리자가 검토합니다.`}
            actions={
              <PartnerPendingButtonLink
                href={getCompanyScopedPortalHref(scope.id)}
                variant="secondary"
              >
                대시보드로 돌아가기
              </PartnerPendingButtonLink>
            }
          />

          <PartnerRegistrationClient
            categories={categoriesResult.data ?? []}
            webAction={createPartnerPortalBrandRegistrationRequestAction}
            showExcelTab={false}
            lockCompanyName
            titleBadge="파트너 포털 신청"
            submitLabel="브랜드 추가 신청"
            submitPendingLabel="신청 중"
            hiddenFields={{ companyId: scope.id }}
            initialValues={{
              companyName: scope.name,
              companyDescription: scope.description ?? "",
              contactName: session.displayName,
              contactEmail: accountEmail || fallbackEmail,
            }}
          />
        </div>
      </Container>
    </div>
  );
}
