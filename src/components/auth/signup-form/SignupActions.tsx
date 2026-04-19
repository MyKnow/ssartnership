import Button from "@/components/ui/Button";
import type { SignupStep } from "@/components/auth/signup-form/types";

export default function SignupActions({
  step,
  codeRequested,
  requestCodeLabel,
  pending,
  onRequestCode,
  onNext,
  onSubmitSignup,
  onResetToRequest,
  onResetToAuth,
}: {
  step: SignupStep;
  codeRequested: boolean;
  requestCodeLabel: string;
  pending: boolean;
  onRequestCode: () => void;
  onNext: () => void;
  onSubmitSignup: () => void;
  onResetToRequest: () => void;
  onResetToAuth: () => void;
}) {
  if (step === "auth" && !codeRequested) {
    return (
      <Button onClick={onRequestCode} loading={pending} loadingText="전송 중">
        {requestCodeLabel}
      </Button>
    );
  }

  if (step === "auth") {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={onNext} disabled={pending}>
          다음
        </Button>
        <Button variant="ghost" onClick={onResetToRequest} disabled={pending}>
          인증 정보 수정
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={onSubmitSignup} loading={pending} loadingText="가입 처리 중">
        회원가입
      </Button>
      <Button variant="ghost" onClick={onResetToAuth} disabled={pending}>
        인증 정보 수정
      </Button>
    </div>
  );
}
