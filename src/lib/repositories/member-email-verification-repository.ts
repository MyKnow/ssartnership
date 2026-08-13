export const MEMBER_EMAIL_VERIFICATION_FAILURE_REASONS = [
  "invalid_request",
  "member_missing",
  "challenge_missing",
  "challenge_consumed",
  "challenge_expired",
  "attempts_exhausted",
  "invalid_code",
  "email_conflict",
  "email_reserved",
] as const;

export type MemberEmailVerificationFailureReason =
  (typeof MEMBER_EMAIL_VERIFICATION_FAILURE_REASONS)[number];

export type CompleteMemberEmailVerificationInput = {
  memberId: string;
  emailNormalized: string;
  emailReservationHash: string;
  codeHash: string;
};

export type CompleteMemberEmailVerificationResult =
  | { verified: true }
  | {
      verified: false;
      reason: MemberEmailVerificationFailureReason;
    };

export interface MemberEmailVerificationRepository {
  completeMemberEmailVerification(
    input: CompleteMemberEmailVerificationInput,
  ): Promise<CompleteMemberEmailVerificationResult>;
}

export class MemberEmailVerificationStorageError extends Error {
  readonly code = "member_email_verification_storage_failed" as const;

  constructor() {
    super("member_email_verification_storage_failed");
    this.name = "MemberEmailVerificationStorageError";
  }
}

export function isMemberEmailVerificationFailureReason(
  value: unknown,
): value is MemberEmailVerificationFailureReason {
  return (
    typeof value === "string" &&
    (MEMBER_EMAIL_VERIFICATION_FAILURE_REASONS as readonly string[]).includes(
      value,
    )
  );
}
