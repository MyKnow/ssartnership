import {
  MemberEmailChallengeStorageError,
  type MemberEmailChallengeRpcExecutor,
  type MemberEmailChallengeRpcNames,
  SupabaseMemberEmailChallengeRepository,
} from "@/lib/repositories/supabase/member-email-verification-challenge-repository.supabase";

const RECOVERY_CHALLENGE_RPC_NAMES = {
  reserve: "reserve_member_email_recovery_challenge",
  markSent: "mark_member_email_recovery_challenge_sent",
  deletePending: "delete_pending_member_email_recovery_challenge",
} satisfies MemberEmailChallengeRpcNames;

export class SupabaseMemberEmailRecoveryChallengeRepository extends SupabaseMemberEmailChallengeRepository {
  constructor(runRpc?: MemberEmailChallengeRpcExecutor) {
    super(RECOVERY_CHALLENGE_RPC_NAMES, runRpc);
  }
}

export { MemberEmailChallengeStorageError };
