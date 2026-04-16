import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";
import { isPartnerPortalMock } from "@/lib/partner-portal";

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
] as const;

export default function PartnerSetupHero({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur md:p-8">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary">초기 설정</Badge>
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
              전달받은 초기 설정 링크로 들어와 이메일 인증과 비밀번호 설정을 한 번에 마치면,
              이후부터는 협력사 포털로 로그인할 수 있습니다.
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
              <h2 className="mt-1 text-lg font-semibold text-foreground">3단계로 마무리</h2>
            </div>
            <Badge className="bg-primary/10 text-primary">한 번만 설정</Badge>
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
  );
}
