import {
  isMemberEmailVerificationFailureReason,
  MemberEmailVerificationStorageError,
  type CompleteMemberEmailVerificationInput,
  type CompleteMemberEmailVerificationResult,
  type MemberEmailVerificationRepository,
} from "@/lib/repositories/member-email-verification-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type MemberEmailVerificationRpcResponse = {
  data: unknown;
  error: unknown;
};

type MemberEmailVerificationRpcExecutor = (
  functionName: string,
  parameters: Record<string, unknown>,
) => PromiseLike<MemberEmailVerificationRpcResponse>;

function parseCompletionResult(
  value: unknown,
): CompleteMemberEmailVerificationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const result = value as { verified?: unknown; reason?: unknown };
  if (result.verified === true) {
    return { verified: true };
  }
  if (
    result.verified === false &&
    isMemberEmailVerificationFailureReason(result.reason)
  ) {
    return { verified: false, reason: result.reason };
  }
  return null;
}

function executeMemberEmailVerificationRpc(
  functionName: string,
  parameters: Record<string, unknown>,
) {
  return getSupabaseAdminClient().rpc(functionName, parameters);
}

export class SupabaseMemberEmailVerificationRepository
  implements MemberEmailVerificationRepository
{
  private readonly executeRpc: MemberEmailVerificationRpcExecutor;

  constructor(
    executeRpc: MemberEmailVerificationRpcExecutor =
      executeMemberEmailVerificationRpc,
  ) {
    this.executeRpc = executeRpc;
  }

  async completeMemberEmailVerification(
    input: CompleteMemberEmailVerificationInput,
  ): Promise<CompleteMemberEmailVerificationResult> {
    let response: MemberEmailVerificationRpcResponse;
    try {
      response = await this.executeRpc("complete_member_email_verification", {
        p_member_id: input.memberId,
        p_email_normalized: input.emailNormalized,
        p_email_reservation_hash: input.emailReservationHash,
        p_code_hash: input.codeHash,
      });
    } catch {
      throw new MemberEmailVerificationStorageError();
    }

    const result = parseCompletionResult(response.data);
    if (response.error || !result) {
      throw new MemberEmailVerificationStorageError();
    }
    return result;
  }
}

export { MemberEmailVerificationStorageError };
