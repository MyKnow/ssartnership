import {
  MemberEmailRecoveryStorageError,
  type CompleteMemberEmailRecoveryInput,
  type CompleteMemberEmailRecoveryResult,
  type MemberEmailRecoveryRepository,
} from "@/lib/repositories/member-email-recovery-repository";
import { isMemberEmailVerificationFailureReason } from "@/lib/repositories/member-email-verification-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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

function parseCompletion(
  value: unknown,
): CompleteMemberEmailRecoveryResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const result = value as {
    verified?: unknown;
    reason?: unknown;
    mustChangePassword?: unknown;
  };
  if (
    result.verified === true &&
    typeof result.mustChangePassword === "boolean"
  ) {
    return {
      verified: true,
      mustChangePassword: result.mustChangePassword,
    };
  }
  if (
    result.verified === false &&
    isMemberEmailVerificationFailureReason(result.reason)
  ) {
    return { verified: false, reason: result.reason };
  }
  return null;
}

export class SupabaseMemberEmailRecoveryRepository
  implements MemberEmailRecoveryRepository
{
  private readonly runRpc: RpcExecutor;

  constructor(runRpc: RpcExecutor = executeRpc) {
    this.runRpc = runRpc;
  }

  async completeMemberEmailRecovery(
    input: CompleteMemberEmailRecoveryInput,
  ): Promise<CompleteMemberEmailRecoveryResult> {
    let response: RpcResponse;
    try {
      response = await this.runRpc("complete_member_email_recovery", {
        p_member_id: input.memberId,
        p_email_normalized: input.emailNormalized,
        p_email_reservation_hash: input.emailReservationHash,
        p_code_hash: input.codeHash,
      });
    } catch {
      throw new MemberEmailRecoveryStorageError();
    }

    const completion = parseCompletion(response.data);
    if (response.error || !completion) {
      throw new MemberEmailRecoveryStorageError();
    }
    return completion;
  }
}

export { MemberEmailRecoveryStorageError };
