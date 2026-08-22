import { MockWalletPassRepository } from "@/lib/repositories/mock/wallet-pass-repository.mock";
import { SupabaseWalletPassRepository } from "@/lib/repositories/supabase/wallet-pass-repository.supabase";
import type { WalletPassRepository } from "@/lib/repositories/wallet-pass-repository";

export type WalletPassRepositoryEnvironment = {
  NEXT_PUBLIC_DATA_SOURCE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export class WalletPassRepositoryUnavailableError extends Error {
  readonly code = "wallet_pass_repository_unavailable" as const;

  constructor() {
    super("Apple Wallet 저장소를 사용할 수 없습니다.");
    this.name = "WalletPassRepositoryUnavailableError";
  }
}

async function rejectUnavailableWalletPassOperation(): Promise<never> {
  throw new WalletPassRepositoryUnavailableError();
}

class UnavailableWalletPassRepository implements WalletPassRepository {
  readonly getWalletPassByPublicId = rejectUnavailableWalletPassOperation;
  readonly getAppleWalletPassBySerialNumber = rejectUnavailableWalletPassOperation;
  readonly getMemberWalletPass = rejectUnavailableWalletPassOperation;
  readonly listAppleWalletDeviceRegistrationsForPass = rejectUnavailableWalletPassOperation;
  readonly listAppleWalletPassesForReconciliation = rejectUnavailableWalletPassOperation;
  readonly issueMemberWalletPass = rejectUnavailableWalletPassOperation;
  readonly revokeMemberWalletPass = rejectUnavailableWalletPassOperation;
  readonly registerAppleWalletDevice = rejectUnavailableWalletPassOperation;
  readonly unregisterAppleWalletDevice = rejectUnavailableWalletPassOperation;
  readonly listUpdatedAppleWalletPasses = rejectUnavailableWalletPassOperation;
  readonly markWalletPassSyncSuccess = rejectUnavailableWalletPassOperation;
  readonly markWalletPassSyncFailure = rejectUnavailableWalletPassOperation;
  readonly reconcileWalletPassContent = rejectUnavailableWalletPassOperation;
}

export function createWalletPassRepository(
  environment: WalletPassRepositoryEnvironment,
): WalletPassRepository {
  if (environment.NEXT_PUBLIC_DATA_SOURCE === "mock") {
    return new MockWalletPassRepository();
  }

  const hasSupabaseAdminEnv =
    Boolean(environment.SUPABASE_URL?.trim()) &&
    Boolean(environment.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (!hasSupabaseAdminEnv) {
    return new UnavailableWalletPassRepository();
  }

  return new SupabaseWalletPassRepository();
}

export const walletPassRepository = createWalletPassRepository({
  NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
