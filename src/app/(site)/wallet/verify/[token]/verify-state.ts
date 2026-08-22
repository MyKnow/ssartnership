import type { MemberCanonicalProfile } from "@/lib/member-profile-view";
import { walletPassRepository } from "@/lib/repositories/wallet-pass";
import type { MemberWalletPass } from "@/lib/repositories/wallet-pass-repository";
import {
  getWalletPassForVerification,
} from "@/lib/wallet/wallet-pass-service";
import {
  buildWalletPassDisplaySnapshot,
  getMemberWalletPassEligibility,
  hashWalletPassDisplaySnapshot,
  type WalletPassEligibilityReason,
} from "@/lib/wallet/wallet-pass-eligibility";
import { verifyWalletPassVerificationToken } from "@/lib/wallet/wallet-pass-token";
import { APPLE_WALLET_CONSENT_VERSION } from "@/lib/wallet/wallet-pass-request";

export type WalletVerifyState =
  | {
      kind: "valid";
      pass: MemberWalletPass;
      member: MemberCanonicalProfile;
    }
  | {
      kind: "invalid";
    }
  | {
      kind: "revoked";
    }
  | {
      kind: "consent_required";
    }
  | {
      kind: "outdated";
    }
  | {
      kind: "ineligible";
      reason: WalletPassEligibilityReason;
    };

type ResolveWalletVerifyStateDependencies = {
  getWalletPassForVerification: typeof getWalletPassForVerification;
  verifyWalletPassVerificationToken: typeof verifyWalletPassVerificationToken;
  getWalletPassByPublicId: typeof walletPassRepository.getWalletPassByPublicId;
  getMemberWalletPassEligibility: typeof getMemberWalletPassEligibility;
};

const defaultDependencies: ResolveWalletVerifyStateDependencies = {
  getWalletPassForVerification,
  verifyWalletPassVerificationToken,
  getWalletPassByPublicId: walletPassRepository.getWalletPassByPublicId.bind(
    walletPassRepository,
  ),
  getMemberWalletPassEligibility,
};

export async function resolveWalletVerifyState(
  token: string,
  dependencies: ResolveWalletVerifyStateDependencies = defaultDependencies,
): Promise<WalletVerifyState> {
  if (!token || token.length > 128) {
    return { kind: "invalid" };
  }

  const verified = await dependencies.getWalletPassForVerification(token);
  if (verified) {
    return {
      kind: "valid",
      pass: verified.pass,
      member: verified.member,
    };
  }

  let parsed;
  try {
    parsed = dependencies.verifyWalletPassVerificationToken(token);
  } catch {
    return { kind: "invalid" };
  }
  if (!parsed) {
    return { kind: "invalid" };
  }

  const pass = await dependencies.getWalletPassByPublicId(parsed.publicId);
  if (!pass) {
    return { kind: "invalid" };
  }

  if (pass.credentialStatus === "revoked") {
    return { kind: "revoked" };
  }
  if (pass.consentVersion !== APPLE_WALLET_CONSENT_VERSION) {
    return { kind: "consent_required" };
  }

  const eligibility = await dependencies.getMemberWalletPassEligibility(
    pass.memberId,
  );
  if (!eligibility.eligible) {
    return { kind: "ineligible", reason: eligibility.reason };
  }
  if (
    hashWalletPassDisplaySnapshot(
      buildWalletPassDisplaySnapshot(eligibility.member),
    ) !== pass.currentSnapshotHash
  ) {
    return { kind: "outdated" };
  }

  return { kind: "invalid" };
}

export function decodeWalletPassTokenSegment(value: string | null | undefined) {
  if (!value) return "";
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded.length <= 128 ? decoded : "";
  } catch {
    return "";
  }
}
