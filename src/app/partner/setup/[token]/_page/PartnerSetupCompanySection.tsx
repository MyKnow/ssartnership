import PartnerSetupForm from "@/components/partner/PartnerSetupForm";
import PortalBadge, { type PortalBadgeTone } from "@/components/portal-v2/PortalBadge";
import { PortalButtonLink } from "@/components/portal-v2/PortalButton";
import PortalPanel from "@/components/portal-v2/PortalPanel";
import type { AwaitedPartnerSetupContext } from "@/app/partner/setup/[token]/_page/types";
import {
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";

const VISIBILITY_TONES: Record<string, PortalBadgeTone> = {
  public: "success",
  confidential: "warning",
  private: "neutral",
  upcoming: "info",
  expired: "danger",
};

export default function PartnerSetupCompanySection({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PartnerSetupFormPanel context={context} />
      <PartnerSetupCompanyCard context={context} />
    </div>
  );
}

export function PartnerSetupFormPanel({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  if (context.isSetupComplete) {
    return (
      <PortalPanel
        title="이미 초기 설정이 완료되었습니다"
        description="이 링크에서는 더 설정할 내용이 없습니다. 파트너사 포털 로그인으로 이동해 바로 사용하면 됩니다."
        actions={<PortalBadge tone="success">로그인 가능</PortalBadge>}
      >
        <div className="flex flex-col gap-3 border-t border-pv2-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="pv2-caption text-ko-pretty text-pv2-muted">
            로그인 후 연결된 제휴처의 소개, 이미지, 운영 정보를 관리하세요.
          </p>
          <PortalButtonLink href="/partner/login" variant="primary" className="w-full sm:w-auto">
            로그인으로 이동
          </PortalButtonLink>
        </div>
      </PortalPanel>
    );
  }

  return (
    <PortalPanel
      title="새 비밀번호를 설정하세요"
      description="다른 플랫폼에서 사용하지 않는 비밀번호로 설정하는 것을 권장드립니다."
    >
      <PartnerSetupForm context={context} />
    </PortalPanel>
  );
}

export function PartnerSetupCompanyCard({
  context,
}: {
  context: AwaitedPartnerSetupContext;
}) {
  return (
    <PortalPanel
      title={context.company.name}
      description={context.company.description ?? "연결된 제휴처 정보를 확인할 수 있습니다."}
      actions={<PortalBadge tone="info">제휴처 {context.company.services.length}개</PortalBadge>}
    >
      <ol className="flex flex-col gap-3">
        {context.company.services.map((service) => (
          <li
            key={service.id}
            className="min-w-0 rounded-pv2-control border border-pv2-border bg-pv2-grid p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate pv2-label text-pv2-text">{service.name}</p>
              <PortalBadge tone={VISIBILITY_TONES[service.visibility] ?? "neutral"}>
                {getPartnerVisibilityLabel(service.visibility)}
              </PortalBadge>
            </div>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="pv2-caption text-pv2-muted">카테고리</dt>
                <dd className="pv2-body text-pv2-text">{service.categoryLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="pv2-caption text-pv2-muted">위치</dt>
                <dd className="pv2-body text-pv2-text">{service.location}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </PortalPanel>
  );
}
