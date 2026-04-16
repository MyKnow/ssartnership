import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PartnerSetupForm from "@/components/partner/PartnerSetupForm";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";

export default function PartnerSetupCompanySection({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">회사 정보</h2>
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
              <h2 className="text-xl font-semibold text-foreground">연결 서비스</h2>
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
                  <p className="font-semibold text-foreground">{service.name}</p>
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
            <Badge className="bg-primary/10 text-primary">비밀번호 설정</Badge>
            <Badge className="bg-surface text-muted-foreground">1회 인증</Badge>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              이메일 코드와 새 비밀번호 입력
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              초기 설정 링크는 한 번만 사용할 수 있습니다. 이메일 인증 코드를 입력한 뒤
              새 비밀번호를 저장해 주세요.
            </p>
          </div>
        </div>

        <PartnerSetupForm context={context} />
      </Card>
    </div>
  );
}
