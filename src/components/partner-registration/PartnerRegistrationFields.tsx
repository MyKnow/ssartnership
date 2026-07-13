import type { ComponentProps } from "react";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import type {
  PartnerRegistrationFieldErrors,
  PartnerRegistrationFieldName,
} from "@/lib/partner-registration";

const invalidFieldClassName =
  "border-danger/50 bg-danger/5 focus:border-danger focus:ring-danger/15";

export function PartnerRegistrationField({
  label,
  name,
  required = false,
  description,
  error,
  children,
}: {
  label: string;
  name: PartnerRegistrationFieldName;
  required?: boolean;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2" htmlFor={`partner-registration-${name}`}>
      <span className="ui-caption inline-flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        {required ? (
          <span className="shrink-0 text-danger" aria-label="필수 입력">*</span>
        ) : (
          <span
            aria-label="선택 입력"
            className="inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-surface-control px-1.5 text-[10px] font-semibold leading-none tracking-normal text-muted-foreground"
          >
            선택
          </span>
        )}
      </span>
      {children}
      {description ? (
        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs font-medium leading-5 text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function PartnerRegistrationInput({
  name,
  fieldErrors,
  inputRef,
  ...props
}: ComponentProps<typeof Input> & {
  name: PartnerRegistrationFieldName;
  fieldErrors?: PartnerRegistrationFieldErrors;
  inputRef?: (element: HTMLInputElement | null) => void;
}) {
  return (
    <Input
      {...props}
      id={`partner-registration-${name}`}
      name={name}
      ref={inputRef}
      aria-invalid={Boolean(fieldErrors?.[name]) || undefined}
      className={cn(
        fieldErrors?.[name] ? invalidFieldClassName : undefined,
        props.className,
      )}
    />
  );
}

export function PartnerRegistrationTextarea({
  name,
  fieldErrors,
  inputRef,
  ...props
}: ComponentProps<typeof Textarea> & {
  name: PartnerRegistrationFieldName;
  fieldErrors?: PartnerRegistrationFieldErrors;
  inputRef?: (element: HTMLTextAreaElement | null) => void;
}) {
  return (
    <Textarea
      {...props}
      id={`partner-registration-${name}`}
      name={name}
      ref={inputRef}
      aria-invalid={Boolean(fieldErrors?.[name]) || undefined}
      className={cn(
        fieldErrors?.[name] ? invalidFieldClassName : undefined,
        props.className,
      )}
    />
  );
}
