import type { RefObject } from "react";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import { getFieldErrorClass } from "@/components/ui/form-field-state";

export default function SignupVerificationField({
  code,
  error,
  codeRef,
  onCodeChange,
}: {
  code: string;
  error?: string;
  codeRef: RefObject<HTMLInputElement | null>;
  onCodeChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      인증코드
      <Input
        ref={codeRef}
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        placeholder="MM DM으로 받은 코드"
        required
        aria-invalid={Boolean(error) || undefined}
        className={getFieldErrorClass(Boolean(error))}
      />
      {error ? <FormMessage variant="error">{error}</FormMessage> : null}
    </label>
  );
}
