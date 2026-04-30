import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerPasswordResetForm from "@/components/partner/PartnerPasswordResetForm";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `업체 포털 비밀번호 재설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerPasswordResetPage() {
  const session = await getPartnerSession();
  if (session) {
    redirect(session.mustChangePassword ? "/partner/change-password" : "/partner");
  }

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(28rem,0.5fr)] xl:items-start">
          <Card tone="default" className="space-y-4 p-6 sm:p-8">
            <Badge className="bg-primary/10 text-primary">계정 복구</Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              담당자 계정으로 다시 접속하세요.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              임시 비밀번호를 받은 뒤에는 보안을 위해 첫 로그인에서 새 비밀번호
              설정을 완료해야 합니다.
            </p>
          </Card>
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
              <Badge className="bg-surface text-muted-foreground">
                비밀번호 재설정
              </Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                비밀번호 재설정
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                등록된 담당자 이메일을 입력하면 임시 비밀번호를 전송합니다.
                로그인 후에는 새 비밀번호를 반드시 설정해야 합니다.
              </p>
            </div>

            <PartnerPasswordResetForm />
          </Card>
        </div>
      </Container>
    </div>
  );
}
