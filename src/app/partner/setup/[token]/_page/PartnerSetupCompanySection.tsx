import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PartnerSetupForm from "@/components/partner/PartnerSetupForm";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";

export default function PartnerSetupCompanySection({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-start">
      <Card
        padding="none"
        className="overflow-hidden lg:order-2 lg:sticky lg:top-6"
      >
        {context.isSetupComplete ? (
          <>
            <div className="space-y-3 p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600">
                  설정 완료
                </Badge>
                <Badge className="bg-surface text-muted-foreground">
                  로그인 가능
                </Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  이미 초기 설정이 완료되었습니다
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  이 링크에서는 더 설정할 내용이 없습니다.<br />협력사 포털 로그인으로
                  이동해 바로 사용하면 됩니다.
                </p>
              </div>
            </div>

            <div className="border-t border-border bg-surface-inset/80 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-6">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">다음 단계</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  로그인 후 연결된 브랜드의 소개, 이미지, 운영 정보를 관리하세요.
                </p>
              </div>
              <Button className="mt-4 w-full sm:mt-0 sm:w-auto" href="/partner/login">
                로그인으로 이동
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 p-6 pb-5 sm:p-7 sm:pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-surface text-muted-foreground">
                  비밀번호 설정
                </Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  새 비밀번호를 설정하세요
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  다른 플랫폼에서 사용하지 않는 비밀번호로 설정하는 것을 권장드립니다.
                </p>
              </div>
            </div>
            <div className="border-t border-border p-6 sm:p-7">
              <PartnerSetupForm context={context} />
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-5 lg:order-1">
        <div className="space-y-3">
          <Badge className="bg-surface text-muted-foreground">관리 대상</Badge>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              회사명
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {context.company.name}
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {context.company.description ?? "연결된 브랜드 정보를 확인할 수 있습니다."}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">브랜드</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              이 계정으로 수정할 수 있는 대상입니다.
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary">
            {context.company.services.length}개
          </Badge>
        </div>

        <ol className="space-y-3">
          {context.company.services.map((service) => (
            <li
              key={service.id}
              className="rounded-2xl border border-border bg-surface-inset/80 p-4"
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-foreground">
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
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      카테고리
                    </dt>
                    <dd className="mt-1 text-foreground">{service.categoryLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">위치</dt>
                    <dd className="mt-1 text-foreground">{service.location}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
