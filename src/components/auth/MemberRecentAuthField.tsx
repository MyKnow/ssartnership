"use client";

import type { Ref } from "react";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import PasswordInput from "@/components/ui/PasswordInput";
import { getFieldErrorClass } from "@/components/ui/form-field-state";
import {
  MEMBER_CURRENT_PASSWORD_MAX_LENGTH,
  MEMBER_RECENT_AUTH_ERRORS,
  type MemberRecentAuthRequirement,
} from "@/lib/member-recent-auth";

/**
 * Current-password confirmation shown before a sensitive member action when
 * the last sign-in is older than the recent-auth window.
 */
export default function MemberRecentAuthField({
  id,
  requirement,
  value,
  onChange,
  error,
  inputRef,
  disabled,
}: {
  id: string;
  requirement: MemberRecentAuthRequirement;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}) {
  if (requirement === "none") {
    return null;
  }
  if (requirement === "reauthentication") {
    return (
      <InlineMessage
        tone="warning"
        title="다시 로그인이 필요합니다"
        description={MEMBER_RECENT_AUTH_ERRORS.reauthentication_required.message}
        role="status"
      />
    );
  }

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        현재 비밀번호
      </label>
      <p id={hintId} className="text-xs text-muted-foreground">
        최근 10분 안에 로그인하지 않았다면 본인 확인을 위해 현재 비밀번호가 필요합니다.
      </p>
      <PasswordInput
        ref={inputRef}
        id={id}
        name="currentPassword"
        autoComplete="current-password"
        maxLength={MEMBER_CURRENT_PASSWORD_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className={getFieldErrorClass(Boolean(error))}
      />
      {error ? (
        <FormMessage id={errorId} variant="error">
          {error}
        </FormMessage>
      ) : null}
    </div>
  );
}
