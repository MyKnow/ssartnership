import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PortalAuthLayout from "@/components/portal-v2/PortalAuthLayout";
import PartnerPasswordChangeForm from "@/components/partner/PartnerPasswordChangeForm";
import {
  getCompanyScopedPortalHref,
  getPartnerGlobalPortalHref,
} from "@/lib/partner-auth/portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-auth/portal-scope";
import {
  getPartnerLoginHref,
  sanitizePartnerReturnTo,
} from "@/lib/partner-auth/return-to";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `파트너 포털 비밀번호 변경 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerPasswordChangePage({
  searchParams,
}: {
  searchParams?: Promise<{
    companyId?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = sanitizePartnerReturnTo(getSingleSearchParam(params.returnTo));
  const session = await getPartnerSession();
  if (!session) {
    redirect(getPartnerLoginHref(returnTo));
  }

  const requestedCompanyId =
    getSingleSearchParam(params.companyId)?.trim() ?? "";
  const returnCompanyId = session.companyIds.includes(requestedCompanyId)
    ? requestedCompanyId
    : null;
  const companies = returnCompanyId
    ? []
    : await getPartnerPortalCompanySummaries(session.companyIds);
  const profileCompanyId = returnCompanyId ?? companies[0]?.id ?? null;
  // The original destination wins over the company dashboard once the
  // forced change is done; the gate itself is never a destination.
  const successRedirectHref =
    returnTo ??
    (returnCompanyId ? getCompanyScopedPortalHref(returnCompanyId) : "/partner");
  const mustChangePassword = session.mustChangePassword;
  if (!mustChangePassword) {
    redirect(
      returnTo ??
        (profileCompanyId
          ? `${getPartnerGlobalPortalHref("account", profileCompanyId)}#security`
          : "/partner"),
    );
  }
  // Name the actual post-change destination: the preserved deep link when
  // there is one, otherwise the dashboard.
  const description = mustChangePassword
    ? returnTo
      ? "임시 비밀번호 상태에서는 다른 포털 화면으로 이동할 수 없습니다. 변경을 완료하면 원래 열려던 화면으로 이동합니다."
      : "임시 비밀번호 상태에서는 다른 포털 화면으로 이동할 수 없습니다. 변경을 완료하면 대시보드로 이동합니다."
    : "현재 비밀번호와 새 비밀번호를 입력해 계정 보안을 업데이트합니다.";

  return (
    <PortalAuthLayout
      eyebrow="제휴 포털 · 보안 설정"
      title="비밀번호 변경"
      description={description}
    >
      <PartnerPasswordChangeForm
        mustChangePassword={mustChangePassword}
        successRedirectHref={successRedirectHref}
      />
    </PortalAuthLayout>
  );
}
