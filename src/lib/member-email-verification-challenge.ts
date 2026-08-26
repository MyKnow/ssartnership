import type {
  MemberEmailVerificationChallengeRepository,
  ReserveMemberEmailVerificationChallengeInput,
} from "@/lib/repositories/member-email-verification-challenge-repository";
import { SupabaseMemberEmailVerificationChallengeRepository } from "@/lib/repositories/supabase/member-email-verification-challenge-repository.supabase";

const repository = new SupabaseMemberEmailVerificationChallengeRepository();

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
