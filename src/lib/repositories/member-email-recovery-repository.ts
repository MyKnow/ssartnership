import type {
  CompleteMemberEmailVerificationInput,
  MemberEmailVerificationFailureReason,
} from "@/lib/repositories/member-email-verification-repository";

export type CompleteMemberEmailRecoveryInput =
  CompleteMemberEmailVerificationInput;

export type CompleteMemberEmailRecoveryResult =
  | { verified: true; mustChangePassword: boolean }
  | {
      verified: false;
      reason: MemberEmailVerificationFailureReason;
    };

export interface MemberEmailRecoveryRepository {
  completeMemberEmailRecovery(
    input: CompleteMemberEmailRecoveryInput,
  ): Promise<CompleteMemberEmailRecoveryResult>;
}

export class MemberEmailRecoveryStorageError extends Error {
  readonly code = "member_email_recovery_storage_failed" as const;

  constructor() {
    super("member_email_recovery_storage_failed");
    this.name = "MemberEmailRecoveryStorageError";
  }
}
