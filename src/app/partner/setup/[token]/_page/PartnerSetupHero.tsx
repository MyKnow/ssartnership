import PortalBadge from "@/components/portal-v2/PortalBadge";
import { PortalButtonLink } from "@/components/portal-v2/PortalButton";
import PortalPageHeader from "@/components/portal-v2/PortalPageHeader";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";
import { isPartnerPortalMock } from "@/lib/partner-auth/portal";

export default function PartnerSetupHero({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-pv2-panel border border-pv2-border bg-pv2-surface p-4 md:p-8">
      <PortalPageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            초기 설정
            <PortalBadge tone={context.isSetupComplete ? "success" : "info"}>
              {context.isSetupComplete ? "설정 완료" : "비밀번호 설정"}
            </PortalBadge>
          </span>
        }
        title={`${context.company.name} 파트너사 포털 시작하기`}
        description="링크에서 바로 비밀번호를 설정한 뒤 로그인하면, 연결된 제휴처를 바로 관리할 수 있습니다."
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-pv2-control border border-pv2-border bg-pv2-grid p-3">
          <dt className="pv2-caption text-pv2-muted">로그인 아이디</dt>
          <dd className="mt-1 break-all pv2-label text-pv2-text">{context.account.loginId}</dd>
        </div>
        <div className="min-w-0 rounded-pv2-control border border-pv2-border bg-pv2-grid p-3">
          <dt className="pv2-caption text-pv2-muted">담당자</dt>
          <dd className="mt-1 pv2-label text-pv2-text">{context.account.displayName}</dd>
        </div>
        <div className="min-w-0 rounded-pv2-control border border-pv2-border bg-pv2-grid p-3">
          <dt className="pv2-caption text-pv2-muted">소유 제휴처 수</dt>
          <dd className="mt-1 pv2-label text-pv2-text">{context.company.services.length}개</dd>
        </div>
      </dl>
      {isPartnerPortalMock ? (
        <div className="flex justify-end">
          <PortalButtonLink href="/partner/setup">데모 목록</PortalButtonLink>
        </div>
      ) : null}
    </section>
  );
}
