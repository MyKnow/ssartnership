import PartnerPasswordResetForm from "@/components/partner/PartnerPasswordResetForm";
import PortalAuthLayout from "@/components/portal-v2/PortalAuthLayout";

export default function PartnerResetScreen() {
  return (
    <PortalAuthLayout
      eyebrow="제휴 포털 · 계정 복구"
      title="비밀번호 재설정"
      description="등록된 담당자 이메일을 입력하면 임시 비밀번호를 전송합니다. 로그인 후에는 새 비밀번호를 반드시 설정해야 합니다."
    >
      <PartnerPasswordResetForm />
    </PortalAuthLayout>
  );
}
