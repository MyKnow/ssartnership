import { ArrowRight, Building2 } from "lucide-react";
import PartnerPendingLink from "@/components/partner/PartnerPendingLink";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import EmptyState from "@/components/ui/EmptyState";
import MotionReveal from "@/components/ui/MotionReveal";
import ShellHeader from "@/components/ui/ShellHeader";
import type { PartnerPortalCompanyScope } from "@/lib/partner-portal-scope";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import type { PartnerSession } from "@/lib/partner-session";

export default function PartnerCompanySelectionView({
  session,
  companies,
}: {
  session: PartnerSession;
  companies: PartnerPortalCompanyScope[];
}) {
  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-6 lg:pt-8">
        <div className="space-y-6">
          <MotionReveal>
            <ShellHeader
              eyebrow="Partner Portal"
              title="협력사 선택"
              description="관리할 협력사를 선택하면 해당 협력사가 소유한 브랜드의 대시보드와 운영 메뉴로 이동합니다."
              actions={
                <Badge
                  variant="primary"
                  className="max-w-full whitespace-normal break-all text-left leading-snug tracking-normal"
                >
                  로그인 아이디 · {session.loginId}
                </Badge>
              }
            />
          </MotionReveal>

          {companies.length === 0 ? (
            <EmptyState
              title="연결된 협력사가 없습니다."
              description="관리자에서 이 계정과 협력사를 먼저 연결해야 합니다."
            />
          ) : (
            <MotionReveal delay={0.08}>
              <div className="grid gap-4">
                <div className="grid gap-3 rounded-panel border border-border/70 bg-surface-elevated/95 p-4 shadow-flat sm:grid-cols-3">
                  <div>
                    <p className="ui-kicker">로그인 계정</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {session.loginId}
                    </p>
                  </div>
                  <div>
                    <p className="ui-kicker">협력사</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {companies.length.toLocaleString("ko-KR")}개 연결
                    </p>
                  </div>
                  <div>
                    <p className="ui-kicker">브랜드</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {companies
                        .reduce((sum, company) => sum + company.serviceCount, 0)
                        .toLocaleString("ko-KR")}개 관리
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {companies.map((company) => (
                    <PartnerPendingLink
                      key={company.id}
                      href={getCompanyScopedPortalHref(company.id)}
                      className="group block"
                      showSpinner
                    >
                      <Card
                        tone="default"
                        padding="md"
                        className="flex h-full flex-col gap-5 transition-surface-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:border-strong group-hover:shadow-raised"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-border bg-surface-control text-primary">
                            <Building2 className="h-5 w-5" />
                          </span>
                          <Badge variant="neutral">{company.serviceCount}개 브랜드</Badge>
                        </div>
                        <div className="min-w-0 space-y-2">
                          <h2 className="truncate text-xl font-semibold text-foreground">
                            {company.name}
                          </h2>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {company.description?.trim() ||
                              "연결된 브랜드 현황과 운영 알림을 확인합니다."}
                          </p>
                        </div>
                        <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary">
                          선택하기
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Card>
                    </PartnerPendingLink>
                  ))}
                </div>
              </div>
            </MotionReveal>
          )}
        </div>
      </Container>
    </div>
  );
}
