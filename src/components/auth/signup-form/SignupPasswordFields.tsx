import type { RefObject } from "react";
import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import Surface from "@/components/ui/Surface";
import { getFieldErrorClass } from "@/components/ui/form-field-state";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";

export default function SignupPasswordFields({
  password,
  passwordConfirm,
  passwordError,
  passwordConfirmError,
  passwordRef,
  passwordConfirmRef,
  pending,
  onPasswordChange,
  onPasswordConfirmChange,
  onGeneratePassword,
}: {
  password: string;
  passwordConfirm: string;
  passwordError?: string;
  passwordConfirmError?: string;
  passwordRef: RefObject<HTMLInputElement | null>;
  passwordConfirmRef: RefObject<HTMLInputElement | null>;
  pending: boolean;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onGeneratePassword: () => void;
}) {
  return (
    <Surface level="elevated" padding="md" className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          회원가입
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          로그인에 사용할 사이트 비밀번호를 설정합니다.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        <span className="flex items-center justify-between gap-3">
          <span>사용할 비밀번호</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onGeneratePassword}
            disabled={pending}
          >
            <Sparkles size={16} />
            랜덤 생성
          </Button>
        </span>
        <PasswordInput
          ref={passwordRef}
          value={password}
          autoComplete="new-password"
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="영문/숫자/특수문자 포함 8자 이상"
          disabled={pending}
          required
          aria-invalid={Boolean(passwordError) || undefined}
          className={getFieldErrorClass(Boolean(passwordError))}
        />
        {passwordError ? <FormMessage variant="error">{passwordError}</FormMessage> : null}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        비밀번호 재입력
        <PasswordInput
          ref={passwordConfirmRef}
          value={passwordConfirm}
          autoComplete="new-password"
          onChange={(event) => onPasswordConfirmChange(event.target.value)}
          placeholder="다시 입력해 주세요"
          disabled={pending}
          required
          aria-invalid={Boolean(passwordConfirmError) || undefined}
          className={getFieldErrorClass(Boolean(passwordConfirmError))}
        />
        {passwordConfirmError ? (
          <FormMessage variant="error">{passwordConfirmError}</FormMessage>
        ) : null}
      </label>

      <FormMessage>{PASSWORD_POLICY_MESSAGE}</FormMessage>
    </Surface>
  );
}
