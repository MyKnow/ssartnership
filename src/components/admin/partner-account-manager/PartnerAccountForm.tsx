import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import { updatePartnerAccount } from "@/app/admin/(protected)/actions";
import FieldGroup from "@/components/admin/partner-account-manager/FieldGroup";
import { formatPartnerAccountDateTime } from "@/components/admin/partner-account-manager/helpers";
import type { AdminPartnerAccount } from "@/components/admin/partner-account-manager/types";

export default function PartnerAccountForm({
  account,
  formId,
}: {
  account: AdminPartnerAccount;
  formId: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">계정 정보</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            로그인 아이디, 표시명, 활성 상태를 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            생성 {formatPartnerAccountDateTime(account.created_at)}
          </Badge>
          <Badge variant="neutral">
            수정 {formatPartnerAccountDateTime(account.updated_at)}
          </Badge>
        </div>
      </div>

      <form
        id={formId}
        action={updatePartnerAccount}
        className="mt-4 grid gap-4 md:grid-cols-2"
      >
        <input type="hidden" name="id" value={account.id} />
        <FieldGroup label="로그인 아이디(이메일)">
          <Input
            name="loginId"
            type="email"
            defaultValue={account.login_id}
            autoComplete="email"
            required
          />
        </FieldGroup>
        <FieldGroup label="표시명">
          <Input
            name="displayName"
            defaultValue={account.display_name}
            autoComplete="name"
            required
          />
        </FieldGroup>

        <div className="md:col-span-2 grid gap-3 rounded-2xl border border-border/70 bg-surface-muted/70 p-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <input type="hidden" name="isActive" value="false" />
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={account.is_active !== false}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            계정 활성
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <input type="hidden" name="mustChangePassword" value="false" />
            <input
              type="checkbox"
              name="mustChangePassword"
              value="true"
              defaultChecked={Boolean(account.must_change_password)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            다음 로그인 시 비밀번호 변경
          </label>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <SubmitButton pendingText="저장 중" form={formId} className="w-full sm:w-auto">
            계정 저장
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
