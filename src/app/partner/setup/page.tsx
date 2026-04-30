import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import { notFound } from "next/navigation";
import { listPartnerPortalDemoSetups } from "@/lib/partner-auth";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `제휴 포털 초기 설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PartnerSetupIndexPage() {
  if (!isPartnerPortalMock) {
    notFound();
  }

  const setups = await listPartnerPortalDemoSetups();

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-8 lg:pt-10">
        <div className="space-y-6">
          <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-border bg-surface px-6 py-8 shadow-flat sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">
                제휴 포털 초기 설정
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              담당자 이메일로 들어와
              <br />
              처음 비밀번호를 설정하세요.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              제휴 체결 후 관리자에게 받은 초기 설정 링크에서 새 비밀번호만
              설정하면, 이후부터는 업체 포털로 로그인할 수 있습니다.
            </p>
            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-surface-inset/80 p-4">
                1. 담당자 이메일 확인
              </div>
              <div className="rounded-2xl border border-border bg-surface-inset/80 p-4">
                2. 초기 설정 링크 접속
              </div>
              <div className="rounded-2xl border border-border bg-surface-inset/80 p-4">
                3. 새 비밀번호 설정
              </div>
            </div>
          </div>

          {setups.length === 0 ? (
            <EmptyState
              title="초기 설정 데모가 없습니다."
              description="관리자에서 초기 설정용 토큰이 만들어지면 여기에서 테스트할 수 있습니다."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {setups.map((setup) => (
                <Card key={setup.token} className="flex h-full flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {setup.companyName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        로그인 아이디: {setup.loginId}
                      </p>
                    </div>
                    <Badge
                      className={
                        setup.isSetupComplete
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-primary/10 text-primary"
                      }
                    >
                      {setup.isSetupComplete ? "완료됨" : "대기 중"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-surface-inset/80 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        서비스 수
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {setup.serviceCount}개
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-inset/80 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        초기 설정 상태
                      </p>
                      <p className="mt-2 break-all text-lg font-semibold text-foreground">
                        {setup.isSetupComplete ? "완료됨" : "대기 중"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface-inset/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      토큰
                    </p>
                    <p className="mt-2 break-all text-sm text-foreground">
                      {setup.token}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-3">
                    <Button href={`/partner/setup/${setup.token}`}>
                      초기 설정 열기
                    </Button>
                    <Button variant="ghost" href={`/partner/setup/${setup.token}`}>
                      미리보기
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
