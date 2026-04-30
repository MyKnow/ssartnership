import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PartnerAccountForm from "@/components/admin/partner-account-manager/PartnerAccountForm";
import PartnerAccountHeader from "@/components/admin/partner-account-manager/PartnerAccountHeader";
import PartnerAccountLinks from "@/components/admin/partner-account-manager/PartnerAccountLinks";
import { formatPartnerAccountDateTime } from "@/components/admin/partner-account-manager/helpers";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function PartnerAccountCard({
  account,
  companies,
  generatedSetupUrl,
}: {
  account: AdminPartnerAccount;
  companies: {
    id: string;
    name: string;
    slug: string;
  }[];
  generatedSetupUrl?: string | null;
}) {
  const accountFormId = `partner-account-form-${account.id}`;
  const hasActiveSetupLink = Boolean(account.initial_setup_link_sent_at);

  return (
    <Card padding="none" className="overflow-hidden">
      <details className="group">
        <summary className="grid cursor-pointer list-none gap-4 px-5 py-4 transition hover:bg-surface-muted/50 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={account.is_active ? "success" : "danger"}>
                {account.is_active ? "활성" : "비활성"}
              </Badge>
              <Badge variant={account.must_change_password ? "warning" : "neutral"}>
                {account.must_change_password ? "비밀번호 변경 필요" : "일반"}
              </Badge>
              <Badge variant="neutral">
                협력사 {account.links.length}개
              </Badge>
              <Badge
                variant={
                  account.initial_setup_completed_at
                    ? "success"
                    : hasActiveSetupLink
                      ? "primary"
                      : "neutral"
                }
              >
                {account.initial_setup_completed_at
                  ? "초기 설정 완료"
                  : hasActiveSetupLink
                    ? "초기설정 URL 전송됨"
                    : "초기설정 URL 미생성"}
              </Badge>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-foreground">
                {account.display_name}
              </h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {account.login_id}
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground md:min-w-[18rem] md:justify-items-end">
            <p>생성 {formatPartnerAccountDateTime(account.created_at)}</p>
            <p>최근 로그인 {formatPartnerAccountDateTime(account.last_login_at)}</p>
            <span className="text-xs font-semibold text-primary">
              펼쳐서 관리
            </span>
          </div>
        </summary>

        <div className="grid gap-5 border-t border-border/70 bg-surface-inset/40 p-5 md:p-6">
          <PartnerAccountHeader account={account} generatedSetupUrl={generatedSetupUrl} />

          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <PartnerAccountForm account={account} formId={accountFormId} />
            <PartnerAccountLinks account={account} companies={companies} />
          </div>
        </div>
      </details>
    </Card>
  );
}
