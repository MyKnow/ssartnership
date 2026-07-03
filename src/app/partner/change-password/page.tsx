import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerPasswordChangeForm from "@/components/partner/PartnerPasswordChangeForm";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
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
  const requestedCompanyId = getSingleSearchParam(params.companyId)?.trim() ?? "";
  const returnCompanyId = session.companyIds.includes(requestedCompanyId)
    ? requestedCompanyId
    : null;
  const successRedirectHref = returnCompanyId
    ? getCompanyScopedPortalHref(returnCompanyId)
    : "/partner";

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(28rem,0.5fr)] xl:items-start">
          <Card tone="default" className="space-y-4 p-6 sm:p-8">
            <Badge className="bg-primary/10 text-primary">보안 설정</Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              포털 이용 전 비밀번호를 정리합니다.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              임시 비밀번호 상태에서는 다른 포털 화면으로 이동할 수 없습니다.
              변경을 완료하면 대시보드로 이동합니다.
            </p>
          </Card>
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                비밀번호 변경
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                임시 비밀번호로 로그인한 경우, 변경을 완료해야 다른 페이지를 이용할 수 있습니다.
              </p>
            </div>

            <PartnerPasswordChangeForm
              mustChangePassword={session.mustChangePassword}
              successRedirectHref={successRedirectHref}
            />
          </Card>
        </div>
      </Container>
    </div>
  );
}
