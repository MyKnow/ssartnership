import PartnerLoginSetupToast from "@/components/partner/PartnerLoginSetupToast";
import PortalAuthLayout from "@/components/portal-v2/PortalAuthLayout";
import { PortalButtonLink } from "@/components/portal-v2/PortalButton";
import {
  PortalField,
  PortalInput,
  portalFieldProps,
} from "@/components/portal-v2/PortalFormControls";
import PortalFormMessage from "@/components/portal-v2/PortalFormMessage";
import PortalPasswordInput from "@/components/portal-v2/PortalPasswordInput";
import PortalSubmitButton from "@/components/portal-v2/PortalSubmitButton";

export type PartnerLoginFormAction = (
  formData: FormData,
) => void | Promise<void>;

export type PartnerLoginScreenProps = {
  action: PartnerLoginFormAction;
  defaultLoginId?: string;
  setupCompleted?: boolean;
  /** Sanitized `/partner` destination to continue after login. */
  returnTo?: string | null;
  fieldErrors?: {
    loginId?: string | null;
    password?: string | null;
  };
  formErrorMessage?: string | null;
};

export default function PartnerLoginScreen({
  action,
  defaultLoginId = "",
  setupCompleted = false,
  returnTo = null,
  fieldErrors = {},
  formErrorMessage = null,
}: PartnerLoginScreenProps) {
  const loginIdError = fieldErrors.loginId ?? undefined;
  const passwordError = fieldErrors.password ?? undefined;

  return (
    <PortalAuthLayout
      eyebrow="제휴 포털"
      title="파트너 포털 로그인"
      description="담당자 이메일과 비밀번호로 로그인하면 연결된 파트너사의 제휴처 정보를 확인할 수 있습니다."
      footer="초기 설정이 끝난 계정만 로그인할 수 있습니다. 아직 설정하지 않았다면 받은 초기 설정 링크를 먼저 열어 주세요."
    >
      <PartnerLoginSetupToast show={setupCompleted} />
      <form action={action} className="flex flex-col gap-4">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <PortalField name="loginId" label="담당자 이메일" error={loginIdError} required>
          <PortalInput
            {...portalFieldProps("loginId", { error: loginIdError })}
            name="loginId"
            type="email"
            defaultValue={defaultLoginId}
            placeholder="partner@example.com"
            autoComplete="email"
            required
          />
        </PortalField>
        <PortalField name="password" label="비밀번호" error={passwordError} required>
          <PortalPasswordInput
            {...portalFieldProps("password", { error: passwordError })}
            name="password"
            placeholder="초기 설정 후 받은 비밀번호"
            autoComplete="current-password"
            required
          />
        </PortalField>
        {formErrorMessage ? (
          <PortalFormMessage variant="error">{formErrorMessage}</PortalFormMessage>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <PortalSubmitButton pendingText="로그인 중">로그인</PortalSubmitButton>
          <PortalButtonLink href="/partner/reset">비밀번호 재설정</PortalButtonLink>
        </div>
      </form>
    </PortalAuthLayout>
  );
}
