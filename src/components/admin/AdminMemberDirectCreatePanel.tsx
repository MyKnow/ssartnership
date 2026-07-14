"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  DIRECT_MEMBER_CREATE_INITIAL_STATE,
  validateDirectMemberCreateInput,
  type DirectMemberCreateField,
  type DirectMemberCreateFieldErrors,
  type DirectMemberCreateFormState,
} from "@/lib/member-direct-create";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";

const FIELD_ORDER: DirectMemberCreateField[] = [
  "loginId",
  "displayName",
  "generation",
  "campus",
  "temporaryPassword",
  "temporaryPasswordConfirmation",
];

function getFirstInvalidField(fieldErrors: DirectMemberCreateFieldErrors) {
  return FIELD_ORDER.find((field) => Boolean(fieldErrors[field]));
}

export default function AdminMemberDirectCreatePanel({
  action,
}: {
  action: (
    prevState: DirectMemberCreateFormState,
    formData: FormData,
  ) => Promise<DirectMemberCreateFormState>;
}) {
  const [state, formAction] = useActionState(
    action,
    DIRECT_MEMBER_CREATE_INITIAL_STATE,
  );
  const [clientFieldErrors, setClientFieldErrors] = useState<DirectMemberCreateFieldErrors>({});
  const [editedFields, setEditedFields] = useState<Partial<Record<DirectMemberCreateField, true>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const loginIdRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef<HTMLInputElement>(null);
  const campusRef = useRef<HTMLInputElement>(null);
  const temporaryPasswordRef = useRef<HTMLInputElement>(null);
  const temporaryPasswordConfirmationRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useMemo(
    () => ({
      loginId: loginIdRef,
      displayName: displayNameRef,
      generation: generationRef,
      campus: campusRef,
      temporaryPassword: temporaryPasswordRef,
      temporaryPasswordConfirmation: temporaryPasswordConfirmationRef,
    }),
    [],
  ) satisfies Record<DirectMemberCreateField, typeof loginIdRef>;
  const fieldErrors = useMemo(() => {
    const next = {
      ...(state.status === "error" ? state.fieldErrors : {}),
      ...clientFieldErrors,
    };
    for (const field of Object.keys(editedFields) as DirectMemberCreateField[]) {
      delete next[field];
    }
    return next;
  }, [clientFieldErrors, editedFields, state.fieldErrors, state.status]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      return;
    }
    if (state.status !== "error") {
      return;
    }
    const nextFieldErrors = state.fieldErrors ?? {};
    focusField(fieldRefs[getFirstInvalidField(nextFieldErrors) ?? "loginId"]);
  }, [state, fieldRefs]);

  function clearFieldError(field: DirectMemberCreateField) {
    setClientFieldErrors((current) => ({ ...current, [field]: undefined }));
    setEditedFields((current) => ({ ...current, [field]: true }));
  }

  return (
    <div className="grid gap-4">
      <form
        ref={formRef}
        action={formAction}
        noValidate
        className="grid gap-4 rounded-3xl border border-border bg-surface p-4 shadow-flat"
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          const validation = validateDirectMemberCreateInput({
            loginId: formData.get("loginId"),
            displayName: formData.get("displayName"),
            generation: formData.get("generation"),
            campus: formData.get("campus"),
            temporaryPassword: formData.get("temporaryPassword"),
            temporaryPasswordConfirmation: formData.get("temporaryPasswordConfirmation"),
          });
          if (validation.ok) {
            setClientFieldErrors({});
            setEditedFields({});
            return;
          }
          event.preventDefault();
          setClientFieldErrors(validation.fieldErrors);
          setEditedFields({});
          focusField(fieldRefs[getFirstInvalidField(validation.fieldErrors) ?? "loginId"]);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            직접 로그인 ID
            <Input
              ref={loginIdRef}
              name="loginId"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="manual-seoul-001"
              aria-invalid={Boolean(fieldErrors.loginId) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.loginId))}
              onChange={() => clearFieldError("loginId")}
            />
            {fieldErrors.loginId ? (
              <FormMessage variant="error">
                {fieldErrors.loginId}
              </FormMessage>
            ) : (
              <span className="text-xs font-normal text-muted-foreground">
                manual-로 시작하며 영문, 숫자, ., _, -만 사용할 수 있습니다.
              </span>
            )}
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            이름
            <Input
              ref={displayNameRef}
              name="displayName"
              autoComplete="name"
              placeholder="홍길동"
              aria-invalid={Boolean(fieldErrors.displayName) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.displayName))}
              onChange={() => clearFieldError("displayName")}
            />
            {fieldErrors.displayName ? (
              <FormMessage variant="error">
                {fieldErrors.displayName}
              </FormMessage>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            기수
            <Input
              ref={generationRef}
              name="generation"
              type="number"
              min="0"
              max="99"
              inputMode="numeric"
              defaultValue="15"
              aria-invalid={Boolean(fieldErrors.generation) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.generation))}
              onChange={() => clearFieldError("generation")}
            />
            {fieldErrors.generation ? (
              <FormMessage variant="error">
                {fieldErrors.generation}
              </FormMessage>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            캠퍼스 <span className="font-normal text-muted-foreground">(선택)</span>
            <Input
              ref={campusRef}
              name="campus"
              autoComplete="off"
              placeholder="서울"
              aria-invalid={Boolean(fieldErrors.campus) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.campus))}
              onChange={() => clearFieldError("campus")}
            />
            {fieldErrors.campus ? (
              <FormMessage variant="error">
                {fieldErrors.campus}
              </FormMessage>
            ) : null}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            임시 비밀번호
            <PasswordInput
              ref={temporaryPasswordRef}
              name="temporaryPassword"
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.temporaryPassword) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.temporaryPassword))}
              onChange={() => clearFieldError("temporaryPassword")}
            />
            {fieldErrors.temporaryPassword ? (
              <FormMessage variant="error">
                {fieldErrors.temporaryPassword}
              </FormMessage>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            임시 비밀번호 확인
            <PasswordInput
              ref={temporaryPasswordConfirmationRef}
              name="temporaryPasswordConfirmation"
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.temporaryPasswordConfirmation) || undefined}
              className={getFieldErrorClass(Boolean(fieldErrors.temporaryPasswordConfirmation))}
              onChange={() => clearFieldError("temporaryPasswordConfirmation")}
            />
            {fieldErrors.temporaryPasswordConfirmation ? (
              <FormMessage variant="error">
                {fieldErrors.temporaryPasswordConfirmation}
              </FormMessage>
            ) : null}
          </label>
        </div>

        <div className="grid gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-foreground">
          <p className="font-semibold">임시 비밀번호는 생성 후 다시 확인할 수 없습니다.</p>
          <p className="text-muted-foreground">
            생성 전 입력한 값을 회원에게 안전한 별도 경로로 전달하고, 첫 로그인 뒤 비밀번호 변경을 안내해 주세요.
          </p>
        </div>

        <div className="flex justify-end">
          <SubmitButton pendingText="계정 생성 중">직접 계정 생성</SubmitButton>
        </div>
      </form>

      {state.status === "success" && state.member ? (
        <InlineMessage
          tone="success"
          title="직접 회원 계정을 생성했습니다."
          description={`${state.member.displayName} · ${state.member.manualLoginId} · 첫 로그인 시 비밀번호 변경이 필요합니다.`}
        />
      ) : null}
      {state.status === "error" && state.message ? (
        <FormMessage variant="error">{state.message}</FormMessage>
      ) : null}
    </div>
  );
}
