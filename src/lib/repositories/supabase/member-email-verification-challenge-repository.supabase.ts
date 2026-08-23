import {
  MemberEmailChallengeStorageError,
  type MemberEmailVerificationChallengeRepository,
  type ReserveMemberEmailVerificationChallengeInput,
  type ReserveMemberEmailVerificationChallengeResult,
} from "@/lib/repositories/member-email-verification-challenge-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ChallengeReservationRow = {
  challenge_id?: unknown;
  accepted?: unknown;
  retry_after_seconds?: unknown;
};

type RpcResponse = {
  data: unknown;
  error: unknown;
};

type RpcExecutor = (
  functionName: string,
  parameters: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

function executeRpc(
  functionName: string,
  parameters: Record<string, unknown>,
) {
  return getSupabaseAdminClient().rpc(functionName, parameters);
}

function parseReservation(
  value: unknown,
): ReserveMemberEmailVerificationChallengeResult | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    return null;
  }
  const candidate = row as ChallengeReservationRow;
  if (
    typeof candidate.challenge_id !== "string" ||
    typeof candidate.accepted !== "boolean" ||
    typeof candidate.retry_after_seconds !== "number" ||
    !Number.isFinite(candidate.retry_after_seconds)
  ) {
    return null;
  }
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil(candidate.retry_after_seconds),
  );
  if (candidate.accepted) {
    return {
      accepted: true,
      challengeId: candidate.challenge_id,
      retryAfterSeconds: 0,
    };
  }
  if (retryAfterSeconds === 0) {
    return null;
  }
  return {
    accepted: false,
    challengeId: candidate.challenge_id,
    retryAfterSeconds,
  };
}

export class SupabaseMemberEmailVerificationChallengeRepository
  implements MemberEmailVerificationChallengeRepository
{
  private readonly runRpc: RpcExecutor;

  constructor(runRpc: RpcExecutor = executeRpc) {
    this.runRpc = runRpc;
  }

  async reserve(
    input: ReserveMemberEmailVerificationChallengeInput,
  ): Promise<ReserveMemberEmailVerificationChallengeResult> {
    try {
      const { data, error } = await this.runRpc(
        "reserve_member_email_verification_challenge",
        {
          p_member_id: input.memberId,
          p_email_normalized: input.emailNormalized,
          p_code_hash: input.codeHash,
          p_expires_at: input.expiresAt,
          p_resend_available_at: input.resendAvailableAt,
        },
      );
      const reservation = parseReservation(data);
      if (error || !reservation) {
        throw new MemberEmailChallengeStorageError();
      }
      return reservation;
    } catch (error) {
      if (error instanceof MemberEmailChallengeStorageError) {
        throw error;
      }
      throw new MemberEmailChallengeStorageError();
    }
  }

  async markSent(challengeId: string) {
    await this.requireTrueRpc(
      "mark_member_email_verification_challenge_sent",
      { p_challenge_id: challengeId },
    );
  }

  async deletePending(challengeId: string) {
    await this.requireTrueRpc(
      "delete_pending_member_email_verification_challenge",
      { p_challenge_id: challengeId },
    );
  }

  private async requireTrueRpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ) {
    try {
      const { data, error } = await this.runRpc(functionName, parameters);
      if (error || data !== true) {
        throw new MemberEmailChallengeStorageError();
      }
    } catch (error) {
      if (error instanceof MemberEmailChallengeStorageError) {
        throw error;
      }
      throw new MemberEmailChallengeStorageError();
    }
  }
}

export { MemberEmailChallengeStorageError };
