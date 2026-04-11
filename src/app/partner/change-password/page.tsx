import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerPasswordChangeForm from "@/components/partner/PartnerPasswordChangeForm";
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

export default async function PartnerPasswordChangePage() {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }

  return (
    <div className="bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-2xl">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
              <Badge className="bg-surface text-muted-foreground">
                비밀번호 변경
              </Badge>
              {session.mustChangePassword ? (
                <Badge className="bg-amber-500/10 text-amber-700">
                  변경 필요
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                비밀번호 변경
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                현재 비밀번호와 새 비밀번호를 입력해 주세요. 임시 비밀번호로
                로그인한 경우, 변경을 완료해야 다른 페이지를 이용할 수
                있습니다.
              </p>
            </div>

            <PartnerPasswordChangeForm mustChangePassword={session.mustChangePassword} />
          </Card>
        </div>
      </Container>
    </div>
  );
}
