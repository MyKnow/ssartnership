export type ReserveMemberEmailVerificationChallengeInput = {
  memberId: string;
  emailNormalized: string;
  codeHash: string;
  expiresAt: string;
  resendAvailableAt: string;
};

export type ReserveMemberEmailVerificationChallengeResult =
  | { accepted: true; challengeId: string; retryAfterSeconds: 0 }
  | { accepted: false; challengeId: string; retryAfterSeconds: number };

export interface MemberEmailVerificationChallengeRepository {
  reserve(
    input: ReserveMemberEmailVerificationChallengeInput,
  ): Promise<ReserveMemberEmailVerificationChallengeResult>;
  markSent(challengeId: string): Promise<void>;
  deletePending(challengeId: string): Promise<void>;
}

export class MemberEmailChallengeStorageError extends Error {
  constructor() {
    super("member_email_challenge_storage_failed");
    this.name = "MemberEmailChallengeStorageError";
  }
}
