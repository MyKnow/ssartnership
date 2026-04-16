import Button from "@/components/ui/Button";
import type { SignupStep } from "@/components/auth/signup-form/types";

export default function SignupActions({
  step,
  pending,
  onRequestCode,
  onVerifyCode,
  onResetToRequest,
}: {
  step: SignupStep;
  pending: boolean;
  onRequestCode: () => void;
  onVerifyCode: () => void;
  onResetToRequest: () => void;
}) {
  if (step === "request") {
    return (
      <Button onClick={onRequestCode} loading={pending} loadingText="코드 전송 중">
        인증코드 요청
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={onVerifyCode} loading={pending} loadingText="가입 처리 중">
        회원가입 완료
      </Button>
      <Button variant="ghost" onClick={onResetToRequest} disabled={pending}>
        다시 요청하기
      </Button>
    </div>
  );
}
