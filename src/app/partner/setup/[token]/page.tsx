import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerSetupForm from "@/components/partner/PartnerSetupForm";
import { getPartnerPortalSetupContext } from "@/lib/partner-auth";
import { isPartnerPortalMock } from "@/lib/partner-portal";
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

  const setupSteps = [
    {
      title: "링크 확인",
      description: "관리자가 전달한 초기 설정 링크로 진입합니다.",
    },
    {
      title: "이메일 인증",
      description: "수신한 설정 코드를 입력해 담당자임을 확인합니다.",
    },
    {
      title: "비밀번호 설정",
      description: "새 비밀번호를 저장하고 포털 로그인 준비를 마칩니다.",
    },
  ];

  return (
    <div className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.92))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:28px_28px] opacity-50 dark:bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] dark:opacity-20" />
      <Container className="relative pb-16 pt-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-8">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
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
                  <Badge className="bg-surface text-muted-foreground">
                    {context.company.services.length}개 서비스
                  </Badge>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                    Partner Portal Setup
                  </p>
                  <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                    {context.company.name} 담당자 초기 설정
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    전달받은 초기 설정 링크로 들어와 이메일 인증과 비밀번호
                    설정을 한 번에 마치면, 이후부터는 협력사 포털로 로그인할 수
                    있습니다.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      로그인 아이디
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-foreground">
                      {context.account.loginId}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      담당자
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {context.account.displayName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {context.company.contactEmail ?? context.account.email}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      연결 서비스
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {context.company.services.length}개
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border/80 bg-background/85 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      진행 순서
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">
                      3단계로 마무리
                    </h2>
                  </div>
                  <Badge className="bg-primary/10 text-primary">
                    한 번만 설정
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {setupSteps.map((step, index) => (
                    <div
                      key={step.title}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{step.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {isPartnerPortalMock ? (
                  <div className="mt-4">
                    <Button variant="ghost" href="/partner/setup">
                      데모 목록
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      회사 정보
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      로그인 후 관리할 협력사 정보입니다.
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary">
                    {context.isSetupComplete ? "설정 완료" : "설정 전"}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      회사명
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {context.company.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {context.company.description ?? "설명이 없습니다."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      연락처
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {context.company.contactName ?? "미정"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {context.company.contactEmail ?? context.account.email}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {context.company.contactPhone ?? "전화번호 미등록"}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      연결 서비스
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      이 계정으로 접근할 수 있는 브랜드 목록입니다.
                    </p>
                  </div>
                  <Badge className="bg-surface text-muted-foreground">
                    총 {context.company.services.length}개
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

            <Card className="space-y-4 xl:sticky xl:top-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/10 text-primary">
                    비밀번호 설정
                  </Badge>
                  <Badge className="bg-surface text-muted-foreground">
                    1회 인증
                  </Badge>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    이메일 코드와 새 비밀번호 입력
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    초기 설정 링크는 한 번만 사용할 수 있습니다. 이메일
                    인증 코드를 입력한 뒤 새 비밀번호를 저장해 주세요.
                  </p>
                </div>
              </div>

              <PartnerSetupForm context={context} />
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
