import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: `업체 포털 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PartnerHomePage() {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-3xl">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">제휴 포털</Badge>
              <Badge className="bg-surface text-muted-foreground">로그인됨</Badge>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                업체 포털에 오신 것을 환영합니다.
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {session.displayName}님 계정으로 로그인되었습니다. 연결된 회사
                수와 서비스 데이터는 다음 단계에서 본격적으로 보여드릴 예정입니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  로그인 아이디
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-foreground">
                  {session.loginId}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  연결 회사
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {session.companyIds.length}개
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  세션 상태
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  분리 세션 활성화
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
              다음 단계에서 회사별 서비스 목록, 조회수/클릭수 집계, 승인
              대기 변경 요청 화면을 붙입니다.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button href="/partner/setup" variant="ghost">
                초기 설정 데모
              </Button>
              <Button href="/" variant="ghost">
                홈으로
              </Button>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
