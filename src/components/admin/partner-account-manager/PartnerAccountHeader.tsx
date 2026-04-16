import Badge from "@/components/ui/Badge";
import SubmitButton from "@/components/ui/SubmitButton";
import PartnerInitialSetupUrlCopyButton from "@/components/admin/PartnerInitialSetupUrlCopyButton";
import {
  createPartnerAccountInitialSetupUrl,
  sendPartnerAccountInitialSetupUrl,
} from "@/app/admin/(protected)/actions";
import {
  buildPartnerInitialSetupUrl,
  formatPartnerAccountDateTime,
} from "@/components/admin/partner-account-manager/helpers";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function PartnerAccountHeader({
  account,
}: {
  account: AdminPartnerAccount;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              account.is_active
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-danger/10 text-danger"
            }
          >
            {account.is_active ? "활성" : "비활성"}
          </Badge>
          <Badge
            className={
              account.must_change_password
                ? "bg-amber-500/10 text-amber-700"
                : "bg-surface text-muted-foreground"
            }
          >
            {account.must_change_password ? "비밀번호 변경 필요" : "일반"}
          </Badge>
          <Badge className="bg-surface text-muted-foreground">
            협력사 연결 {account.links.length}개
          </Badge>
          <Badge
            className={
              account.initial_setup_completed_at
                ? "bg-emerald-500/10 text-emerald-700"
                : account.initial_setup_token
                  ? "bg-sky-500/10 text-sky-700"
                  : "bg-surface text-muted-foreground"
            }
          >
            {account.initial_setup_completed_at
              ? "초기 설정 완료"
              : account.initial_setup_token
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
          <p className="mt-1 text-xs text-muted-foreground">
            이메일 인증: {formatPartnerAccountDateTime(account.email_verified_at)}
            {" · "}
            마지막 로그인: {formatPartnerAccountDateTime(account.last_login_at)}
          </p>
        </div>
      </div>

      <div className="text-right text-xs text-muted-foreground">
        <p className="break-all">계정 ID</p>
        <p className="mt-1 break-all font-mono text-foreground">{account.id}</p>
        <div className="mt-4 flex flex-col gap-2 sm:items-end">
          {!account.initial_setup_completed_at && account.is_active !== false ? (
            <form action={createPartnerAccountInitialSetupUrl}>
              <input type="hidden" name="id" value={account.id} />
              <SubmitButton
                pendingText="생성 중"
                variant="ghost"
                className="w-full sm:w-auto"
              >
                {account.initial_setup_token ? "초기설정 URL 재생성" : "초기설정 URL 생성"}
              </SubmitButton>
            </form>
          ) : null}

          {account.initial_setup_token ? (
            <PartnerInitialSetupUrlCopyButton
              setupUrl={buildPartnerInitialSetupUrl(
                account.initial_setup_token,
                process.env.NEXT_PUBLIC_SITE_URL,
              )}
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
