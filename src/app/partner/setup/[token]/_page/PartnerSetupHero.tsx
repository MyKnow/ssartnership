import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";
import { isPartnerPortalMock } from "@/lib/partner-portal";

export default function PartnerSetupHero({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <section className="rounded-[2rem] border border-border bg-surface/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.25)] backdrop-blur md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-primary/10 text-primary">초기 설정</Badge>
        <Badge
          className={
            context.isSetupComplete
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-surface text-muted-foreground"
          }
        >
          {context.isSetupComplete ? "설정 완료" : "비밀번호 설정"}
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {context.company.name} 협력사 포털 시작하기
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          링크에서 바로 비밀번호를 설정한 뒤 로그인하면, 연결된 브랜드를 바로
          관리할 수 있습니다.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
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
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {context.account.email}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            소유 브랜드 수
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {context.company.services.length}개
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {context.isSetupComplete
              ? "로그인 후 바로 확인할 수 있습니다."
              : "비밀번호 설정 후 바로 관리할 수 있습니다."}
          </p>
        </div>
      </div>

      {isPartnerPortalMock ? (
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" href="/partner/setup">
            데모 목록
          </Button>
        </div>
      ) : null}
    </section>
  );
}
