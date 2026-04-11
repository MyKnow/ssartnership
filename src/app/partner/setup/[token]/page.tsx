import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerSetupForm from "@/components/partner/PartnerSetupForm";
import { getPartnerPortalSetupContext } from "@/lib/partner-auth";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const context = await getPartnerPortalSetupContext(token);

  if (!context) {
    return {
      title: `제휴 포털 초기 설정 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${context.company.name} 초기 설정 | ${SITE_NAME}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PartnerSetupTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getPartnerPortalSetupContext(token);
  if (!context) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/10 text-primary">
                  초기 설정
                </Badge>
                <Badge
                  className={
                    context.isSetupComplete
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-surface text-muted-foreground"
                  }
                >
                  {context.isSetupComplete ? "완료됨" : "진행 전"}
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {context.company.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                담당자 이메일 {context.account.email}로 초기 비밀번호를
                설정합니다.
              </p>
            </div>
            <Button variant="ghost" href="/partner/setup">
              데모 목록
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-surface text-muted-foreground">
                    로그인 아이디
                  </Badge>
                  <span className="text-sm text-foreground">
                    {context.account.loginId}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      담당자
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {context.account.displayName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {context.company.contactEmail ?? context.account.email}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      설정 코드
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {context.demoVerificationCode ?? "미공개"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      mock 데이터에서는 페이지에 코드가 노출됩니다.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      제휴 회사 정보
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      이 계정이 소유한 여러 서비스를 함께 관리합니다.
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary">
                    {context.company.services.length}개 서비스
                  </Badge>
                </div>

                <div className="space-y-3">
                  {context.company.services.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-2xl border border-border bg-background/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          {service.name}
                        </p>
                        <Badge
                          className={
                            service.visibility === "public"
                              ? "bg-primary/10 text-primary"
                              : service.visibility === "confidential"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-slate-500/10 text-slate-600"
                          }
                        >
                          {service.visibility === "public"
                            ? "공개"
                            : service.visibility === "confidential"
                              ? "검토용"
                              : "비공개"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {service.categoryLabel} · {service.location}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  이메일 인증 및 비밀번호 설정
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  초기 설정 링크는 한 번만 사용할 수 있습니다. mock 모드에서는
                  데모 코드가 미리 채워집니다.
                </p>
              </div>
              <PartnerSetupForm context={context} />
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
