import type {
  MemberEmailVerificationChallengeRepository,
  ReserveMemberEmailVerificationChallengeInput,
} from "@/lib/repositories/member-email-verification-challenge-repository";
import { SupabaseMemberEmailVerificationChallengeRepository } from "@/lib/repositories/supabase/member-email-verification-challenge-repository.supabase";

const repository = new SupabaseMemberEmailVerificationChallengeRepository();

export class MemberEmailChallengeIssueError extends Error {
  readonly code = "member_email_challenge_issue_failed" as const;

  constructor(cause?: unknown) {
    super("member_email_challenge_issue_failed", { cause });
    this.name = "MemberEmailChallengeIssueError";
  }
}

export async function issueMemberEmailChallenge(
  input: ReserveMemberEmailVerificationChallengeInput,
  dependencies: {
    repository?: MemberEmailVerificationChallengeRepository;
    beforeDelivery?: () => Promise<void>;
    deliver: () => Promise<void>;
  },
) {
  const challengeRepository = dependencies.repository ?? repository;
  const reservation = await challengeRepository.reserve(input);
  if (!reservation.accepted) {
    return reservation;
  }

  try {
    await dependencies.beforeDelivery?.();
    await dependencies.deliver();
    await challengeRepository.markSent(reservation.challengeId);
    return reservation;
  } catch (error) {
    try {
      await challengeRepository.deletePending(reservation.challengeId);
    } catch (cleanupError) {
      throw new MemberEmailChallengeIssueError(
        new AggregateError([error, cleanupError]),
      );
    }
    throw new MemberEmailChallengeIssueError(error);
  }
}

export async function reserveMemberEmailVerificationChallenge(
  input: ReserveMemberEmailVerificationChallengeInput,
  dependencies: { repository?: MemberEmailVerificationChallengeRepository } = {},
) {
  return (dependencies.repository ?? repository).reserve(input);
}

export async function markMemberEmailVerificationChallengeSent(
  challengeId: string,
  dependencies: { repository?: MemberEmailVerificationChallengeRepository } = {},
) {
  return (dependencies.repository ?? repository).markSent(challengeId);
}

export async function deleteMemberEmailVerificationChallenge(
  challengeId: string,
  dependencies: { repository?: MemberEmailVerificationChallengeRepository } = {},
) {
  return (dependencies.repository ?? repository).deletePending(challengeId);
}
