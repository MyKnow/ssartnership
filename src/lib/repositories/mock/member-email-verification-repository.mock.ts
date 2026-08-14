import {
  MemberEmailVerificationStorageError,
  type CompleteMemberEmailVerificationInput,
  type CompleteMemberEmailVerificationResult,
  type MemberEmailVerificationRepository,
} from "@/lib/repositories/member-email-verification-repository";

type MockMember = {
  id: string;
  emailNormalized: string | null;
  emailVerifiedAt: string | null;
  deletedAt: string | null;
};

type MockChallenge = {
  id: string;
  memberId: string;
  emailNormalized: string;
  purpose: string;
  codeHash: string;
  expiresAt: string;
  verifiedAt: string | null;
  consumedAt: string | null;
  attemptCount: number;
  createdAt: string;
};

type MockMemberEmailVerificationState = {
  now: string;
  members: MockMember[];
  challenges: MockChallenge[];
  reservedEmailHashes?: string[];
  failAfterMemberUpdate?: boolean;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isSha256Hex(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

export class MockMemberEmailVerificationRepository
  implements MemberEmailVerificationRepository
{
  private state: Required<MockMemberEmailVerificationState>;
  private readonly memberLocks = new Map<string, Promise<void>>();

  constructor(state: MockMemberEmailVerificationState) {
    this.state = {
      ...clone(state),
      reservedEmailHashes: [...(state.reservedEmailHashes ?? [])],
      failAfterMemberUpdate: state.failAfterMemberUpdate ?? false,
    };
  }

  getSnapshot() {
    return clone(this.state);
  }

  async completeMemberEmailVerification(
    input: CompleteMemberEmailVerificationInput,
  ): Promise<CompleteMemberEmailVerificationResult> {
    return this.withMemberLock(input.memberId, async () => {
      const working = clone(this.state);
      if (
        !input.memberId ||
        !input.emailNormalized ||
        input.emailNormalized !== input.emailNormalized.trim().toLowerCase() ||
        !isSha256Hex(input.emailReservationHash) ||
        !isSha256Hex(input.codeHash)
      ) {
        return { verified: false, reason: "invalid_request" };
      }

      const member = working.members.find(
        (candidate) =>
          candidate.id === input.memberId && candidate.deletedAt === null,
      );
      if (!member) {
        return { verified: false, reason: "member_missing" };
      }

      const challenge = working.challenges
        .filter(
          (candidate) =>
            candidate.memberId === input.memberId &&
            candidate.emailNormalized === input.emailNormalized &&
            candidate.purpose === "email_verify",
        )
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            right.id.localeCompare(left.id),
        )[0];
      if (!challenge) {
        return { verified: false, reason: "challenge_missing" };
      }
      if (challenge.consumedAt || challenge.verifiedAt) {
        return { verified: false, reason: "challenge_consumed" };
      }

      const now = new Date(working.now).getTime();
      if (new Date(challenge.expiresAt).getTime() <= now) {
        challenge.consumedAt = working.now;
        this.state = working;
        return { verified: false, reason: "challenge_expired" };
      }
      if (challenge.attemptCount >= 10) {
        challenge.consumedAt = working.now;
        this.state = working;
        return { verified: false, reason: "attempts_exhausted" };
      }
      if (challenge.codeHash !== input.codeHash) {
        challenge.attemptCount = Math.min(10, challenge.attemptCount + 1);
        if (challenge.attemptCount >= 10) {
          challenge.consumedAt = working.now;
        }
        this.state = working;
        return { verified: false, reason: "invalid_code" };
      }

      const emailConflict = working.members.some(
        (candidate) =>
          candidate.id !== input.memberId &&
          candidate.deletedAt === null &&
          candidate.emailNormalized === input.emailNormalized,
      );
      if (emailConflict) {
        return { verified: false, reason: "email_conflict" };
      }
      if (working.reservedEmailHashes.includes(input.emailReservationHash)) {
        return { verified: false, reason: "email_reserved" };
      }

      member.emailNormalized = input.emailNormalized;
      member.emailVerifiedAt = working.now;
      if (working.failAfterMemberUpdate) {
        throw new MemberEmailVerificationStorageError();
      }
      challenge.verifiedAt = working.now;
      challenge.consumedAt = working.now;
      challenge.attemptCount = Math.min(10, challenge.attemptCount + 1);
      this.state = working;
      return { verified: true };
    });
  }

  private async withMemberLock<T>(memberId: string, operation: () => Promise<T>) {
    const previous = this.memberLocks.get(memberId) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.memberLocks.set(memberId, previous.then(() => current));
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
