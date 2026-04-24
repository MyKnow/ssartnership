import Badge from "@/components/ui/Badge";
import SubmitButton from "@/components/ui/SubmitButton";
import PartnerInitialSetupUrlCopyButton from "@/components/admin/PartnerInitialSetupUrlCopyButton";
import {
  createPartnerAccountInitialSetupUrl,
  sendPartnerAccountInitialSetupUrl,
} from "@/app/admin/(protected)/actions";
import {
  formatPartnerAccountDateTime,
} from "@/components/admin/partner-account-manager/helpers";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function PartnerAccountHeader({
  account,
  generatedSetupUrl,
}: {
  account: AdminPartnerAccount;
  generatedSetupUrl?: string | null;
}) {
  const hasActiveSetupLink = Boolean(account.initial_setup_expires_at);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={account.is_active ? "success" : "danger"}>
            {account.is_active ? "활성" : "비활성"}
          </Badge>
          <Badge variant={account.must_change_password ? "warning" : "neutral"}>
            {account.must_change_password ? "비밀번호 변경 필요" : "일반"}
          </Badge>
          <Badge variant="neutral">
            협력사 연결 {account.links.length}개
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
                ? account.initial_setup_link_sent_at
                  ? "초기설정 URL 전송됨"
                  : "초기설정 URL 준비됨"
                : "초기설정 URL 미생성"}
          </Badge>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{account.display_name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            로그인 아이디: {account.login_id}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            계정 ID: {account.id}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            이메일 인증: {formatPartnerAccountDateTime(account.email_verified_at)}
            {" · "}
            마지막 로그인: {formatPartnerAccountDateTime(account.last_login_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-2 xl:justify-items-end">
        <div className="flex flex-wrap gap-2 xl:justify-end">
          {!account.initial_setup_completed_at && account.is_active !== false ? (
            <form action={createPartnerAccountInitialSetupUrl}>
              <input type="hidden" name="id" value={account.id} />
              <SubmitButton
                pendingText="생성 중"
                variant="ghost"
                className="w-full sm:w-auto"
              >
                {hasActiveSetupLink ? "초기설정 URL 재생성" : "초기설정 URL 생성"}
              </SubmitButton>
            </form>
          ) : null}

          {generatedSetupUrl ? (
            <PartnerInitialSetupUrlCopyButton
              setupUrl={generatedSetupUrl}
            />
          ) : null}

          {!account.initial_setup_completed_at && account.is_active !== false ? (
            <form action={sendPartnerAccountInitialSetupUrl}>
              <input type="hidden" name="id" value={account.id} />
              <SubmitButton pendingText="전송 중" className="w-full sm:w-auto">
                {account.initial_setup_link_sent_at
                  ? "초기설정 URL 재전송"
                  : "초기설정 URL 메일 전송"}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
