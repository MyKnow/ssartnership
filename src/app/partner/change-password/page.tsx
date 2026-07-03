import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerPasswordChangeForm from "@/components/partner/PartnerPasswordChangeForm";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `업체 포털 비밀번호 변경 | ${SITE_NAME}`,
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
  searchParams?: Promise<{ companyId?: string | string[] }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }

  const params = (await searchParams) ?? {};
  const requestedCompanyId =
    getSingleSearchParam(params.companyId)?.trim() ?? "";
  const returnCompanyId = session.companyIds.includes(requestedCompanyId)
    ? requestedCompanyId
    : null;
  const companies = returnCompanyId
    ? []
    : await getPartnerPortalCompanySummaries(session.companyIds);
  const profileCompanyId = returnCompanyId ?? companies[0]?.id ?? null;
  const successRedirectHref = returnCompanyId
    ? getCompanyScopedPortalHref(returnCompanyId)
    : "/partner";
  const mustChangePassword = session.mustChangePassword;
  if (!mustChangePassword) {
    redirect(
      profileCompanyId
        ? `${getCompanyScopedPortalHref(profileCompanyId, "account")}#security`
        : "/partner",
    );
  }
  const heroTitle = mustChangePassword
    ? "포털 이용 전 비밀번호를 설정합니다."
    : "비밀번호를 변경합니다.";
  const heroDescription = mustChangePassword
    ? "임시 비밀번호 상태에서는 다른 포털 화면으로 이동할 수 없습니다. 변경을 완료하면 대시보드로 이동합니다."
    : "계정 보안을 위해 현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다. 완료 후 이전 협력사 화면으로 돌아갑니다.";
  const formDescription = mustChangePassword
    ? "임시 비밀번호로 로그인한 경우, 변경을 완료해야 다른 페이지를 이용할 수 있습니다."
    : "현재 비밀번호와 새 비밀번호를 입력해 계정 보안을 업데이트합니다.";

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(28rem,0.5fr)] xl:items-start">
          <Card tone="default" className="space-y-4 p-6 sm:p-8">
            <Badge className="bg-primary/10 text-primary">보안 설정</Badge>
            <h1 className="break-keep text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {heroTitle}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {heroDescription}
            </p>
          </Card>
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="break-keep text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                비밀번호 변경
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {formDescription}
              </p>
            </div>

            <PartnerPasswordChangeForm
              mustChangePassword={mustChangePassword}
              successRedirectHref={successRedirectHref}
            />
          </Card>
        </div>
      </Container>
    </div>
  );
}
