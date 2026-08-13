import type {
  CompleteMemberEmailVerificationInput,
  MemberEmailVerificationFailureReason,
  MemberEmailVerificationRepository,
} from "@/lib/repositories/member-email-verification-repository";
import { SupabaseMemberEmailVerificationRepository } from "@/lib/repositories/supabase/member-email-verification-repository.supabase";

const repository = new SupabaseMemberEmailVerificationRepository();

export async function completeMemberEmailVerification(
  input: CompleteMemberEmailVerificationInput,
  dependencies: { repository?: MemberEmailVerificationRepository } = {},
) {
  return (dependencies.repository ?? repository).completeMemberEmailVerification(
    input,
  );
}

export function getMemberEmailVerificationHttpFailure(
  reason: MemberEmailVerificationFailureReason,
) {
  if (reason === "email_conflict") {
    return {
      status: 409,
      message: "이미 다른 계정에서 사용 중인 이메일입니다.",
    } as const;
  }
  if (reason === "email_reserved") {
    return {
      status: 409,
      message: "사용할 수 없는 이메일입니다.",
    } as const;
  }
  if (reason === "member_missing") {
    return {
      status: 401,
      message: "회원 정보를 확인하지 못했습니다.",
    } as const;
  }
  if (reason === "invalid_request") {
    return {
      status: 400,
      message: "이메일과 6자리 인증 코드를 확인해 주세요.",
    } as const;
  }
  return {
    status: 400,
    message: "인증 코드가 올바르지 않거나 만료되었습니다.",
  } as const;
}

export function isMemberEmailVerificationCodeFailure(
  reason: MemberEmailVerificationFailureReason,
) {
  return (
    reason === "invalid_request" ||
    reason === "challenge_missing" ||
    reason === "challenge_consumed" ||
    reason === "challenge_expired" ||
    reason === "attempts_exhausted" ||
    reason === "invalid_code"
  );
}
