import { createHash } from "node:crypto";
import { z } from "zod";
import { walletPassRepository } from "@/lib/repositories/wallet-pass";
import type {
  MemberWalletPass,
  RevokeMemberWalletPassResult,
} from "@/lib/repositories/wallet-pass-repository";
import {
  createAppleWalletPass,
  getAppleWalletConfigStatus,
  sendAppleWalletPassUpdate,
} from "@/lib/wallet/apple";
import type { AppleWalletConfigStatus } from "@/lib/wallet/apple";
import type { AppleWalletConfigWarningCode } from "@/lib/wallet/apple/types";
import {
  decryptApplePushToken,
  type EncryptedApplePushToken,
} from "@/lib/wallet/apple/apple-wallet-device-token";
import {
  buildWalletPassDisplaySnapshot,
  getMemberWalletPassEligibility,
  getWalletPassEligibilityMessage,
  hashWalletPassDisplaySnapshot,
  type WalletPassDisplaySnapshot,
  type WalletPassEligibility,
} from "@/lib/wallet/wallet-pass-eligibility";
import {
  createWalletPassVerificationUrl,
  deriveAppleWalletAuthenticationToken,
  verifyWalletPassVerificationToken,
} from "@/lib/wallet/wallet-pass-token";
import { APPLE_WALLET_CONSENT_VERSION } from "@/lib/wallet/wallet-pass-request";

const displaySnapshotSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    generationLabel: z.string().trim().min(1).max(40),
    campusLabel: z.string().trim().min(1).max(120),
    roleLabel: z.string().trim().min(1).max(40),
  })
  .strict();

export type WalletPassServiceErrorCode =
  | "wallet_not_configured"
  | "wallet_ineligible"
  | "wallet_pass_not_found"
  | "wallet_pass_revoked"
  | "wallet_pass_idempotency_conflict"
  | "wallet_pass_snapshot_invalid"
  | "wallet_pass_snapshot_outdated"
  | "wallet_pass_build_failed";

export class WalletPassServiceError extends Error {
  readonly code: WalletPassServiceErrorCode;

  constructor(code: WalletPassServiceErrorCode, message: string) {
    super(message);
    this.name = "WalletPassServiceError";
    this.code = code;
  }
}

export type AppleWalletReconcileSkipReason =
  | "wallet_disabled"
  | "wallet_config_invalid";

export type ReconcileInstalledAppleWalletPassesResult = {
  skipped: boolean;
  scanned: number;
  invalidated: number;
  failed: number;
  truncated: boolean;
  skipReason: AppleWalletReconcileSkipReason | null;
  configWarningCodes: AppleWalletConfigWarningCode[];
  certificateExpiresInDays: number | null;
};

function requestFingerprint(parts: readonly (string | number)[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function summarizeAppleWalletConfigObservability(
  configStatus: AppleWalletConfigStatus,
): Pick<
  ReconcileInstalledAppleWalletPassesResult,
  "skipReason" | "configWarningCodes" | "certificateExpiresInDays"
> {
  return {
    skipReason: configStatus.ok
      ? null
      : configStatus.code === "disabled"
        ? "wallet_disabled"
        : "wallet_config_invalid",
    configWarningCodes: configStatus.warnings?.map((warning) => warning.code) ?? [],
    certificateExpiresInDays: configStatus.ok
      ? configStatus.config.signerCertificateValidity.expiresInDays
      : null,
  };
}

function mapRepositoryError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("idempotency_conflict")) {
    throw new WalletPassServiceError(
      "wallet_pass_idempotency_conflict",
      "같은 요청 키로 다른 작업을 처리할 수 없습니다.",
    );
  }
  if (message.includes("not_found")) {
    throw new WalletPassServiceError(
      "wallet_pass_not_found",
      "Apple Wallet 패스를 찾을 수 없습니다.",
    );
  }
  throw new WalletPassServiceError(
    "wallet_pass_build_failed",
    "Apple Wallet 요청을 처리하지 못했습니다.",
  );
}

function requireAppleWalletConfig() {
  const status = getAppleWalletConfigStatus();
  if (!status.ok) {
    throw new WalletPassServiceError(
      "wallet_not_configured",
      "Apple Wallet 발급 기능을 준비하고 있습니다.",
    );
  }
  return status.config;
}

function readDisplaySnapshot(pass: MemberWalletPass): WalletPassDisplaySnapshot {
  const result = displaySnapshotSchema.safeParse(pass.currentSnapshot);
  if (!result.success) {
    throw new WalletPassServiceError(
      "wallet_pass_snapshot_invalid",
      "Apple Wallet 패스 정보를 확인할 수 없습니다.",
    );
  }
  return result.data;
}

function isWalletPassSnapshotCurrent(
  pass: MemberWalletPass,
  eligibility: WalletPassEligibility,
) {
  return (
    eligibility.eligible &&
    hashWalletPassDisplaySnapshot(
      buildWalletPassDisplaySnapshot(eligibility.member),
    ) === pass.currentSnapshotHash
  );
}

export async function getAppleWalletMemberState(memberId: string) {
  const [eligibility, pass] = await Promise.all([
    getMemberWalletPassEligibility(memberId),
    walletPassRepository.getMemberWalletPass({
      memberId,
      platform: "apple",
    }),
  ]);
  const snapshotStale = Boolean(
    eligibility.eligible &&
      pass?.credentialStatus === "active" &&
      hashWalletPassDisplaySnapshot(
        buildWalletPassDisplaySnapshot(eligibility.member),
      ) !== pass.currentSnapshotHash,
  );
  return {
    eligibility,
    pass,
    configStatus: getAppleWalletConfigStatus(),
    consentCurrent:
      !pass || pass.consentVersion === APPLE_WALLET_CONSENT_VERSION,
    snapshotStale,
  };
}

export async function issueAppleWalletMemberPass(input: {
  memberId: string;
  consentVersion: number;
  idempotencyKey: string;
}) {
  requireAppleWalletConfig();
  const [eligibility, currentPass] = await Promise.all([
    getMemberWalletPassEligibility(input.memberId),
    walletPassRepository.getMemberWalletPass({
      memberId: input.memberId,
      platform: "apple",
    }),
  ]);
  if (!eligibility.eligible) {
    throw new WalletPassServiceError(
      "wallet_ineligible",
      getWalletPassEligibilityMessage(eligibility.reason),
    );
  }
  const snapshot = buildWalletPassDisplaySnapshot(eligibility.member);
  const snapshotHash = hashWalletPassDisplaySnapshot(snapshot);
  const canReuseCurrentRevision =
    currentPass?.credentialStatus === "active" &&
    currentPass.consentVersion === input.consentVersion &&
    currentPass.currentSnapshotHash === snapshotHash;
  const consentedAt = canReuseCurrentRevision
    ? currentPass.consentedAt
    : new Date().toISOString();
  try {
    const result = await walletPassRepository.issueMemberWalletPass({
      memberId: input.memberId,
      platform: "apple",
      consentVersion: input.consentVersion,
      consentedAt,
      snapshotHash,
      snapshot,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: requestFingerprint([
        "issue",
        input.memberId,
        input.consentVersion,
        snapshotHash,
      ]),
    });
    if (result.isNewRevision && !result.isNewPass) {
      await notifyAppleWalletPassChange(result.pass).catch(() => undefined);
    }
    return result;
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function revokeAppleWalletMemberPass(input: {
  memberId: string;
  idempotencyKey: string;
  reason: "member_requested";
}): Promise<RevokeMemberWalletPassResult> {
  try {
    const result = await walletPassRepository.revokeMemberWalletPass({
      memberId: input.memberId,
      platform: "apple",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: requestFingerprint([
        "revoke",
        input.memberId,
        input.reason,
      ]),
      reason: input.reason,
    });
    await notifyAppleWalletPassChange(result.pass).catch(() => undefined);
    return result;
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function getWalletPassForVerification(token: string) {
  let verification;
  try {
    verification = verifyWalletPassVerificationToken(token);
  } catch {
    return null;
  }
  if (!verification) return null;
  const pass = await walletPassRepository.getWalletPassByPublicId(
    verification.publicId,
  );
  if (
    !pass ||
    pass.credentialStatus !== "active" ||
    pass.consentVersion !== APPLE_WALLET_CONSENT_VERSION
  ) {
    return null;
  }
  const eligibility = await getMemberWalletPassEligibility(pass.memberId);
  if (!eligibility.eligible || !isWalletPassSnapshotCurrent(pass, eligibility)) {
    return null;
  }
  return { pass, member: eligibility.member };
}

export async function getAppleWalletPassForMemberDownload(memberId: string) {
  requireAppleWalletConfig();
  const pass = await walletPassRepository.getMemberWalletPass({
    memberId,
    platform: "apple",
  });
  if (!pass) {
    throw new WalletPassServiceError(
      "wallet_pass_not_found",
      "Apple Wallet 패스를 먼저 발급해 주세요.",
    );
  }
  const buffer = await buildAppleWalletPassBuffer(pass, {
    requireCurrentEligibility: true,
  });
  return { pass, buffer };
}

export async function buildAppleWalletPassBuffer(
  pass: MemberWalletPass,
  options: { requireCurrentEligibility: boolean },
) {
  const config = requireAppleWalletConfig();
  const consentCurrent =
    pass.consentVersion === APPLE_WALLET_CONSENT_VERSION;
  let eligibility: WalletPassEligibility | null = null;
  if (pass.credentialStatus === "active" || options.requireCurrentEligibility) {
    eligibility = await getMemberWalletPassEligibility(pass.memberId);
  }
  const snapshotCurrent = Boolean(
    eligibility && isWalletPassSnapshotCurrent(pass, eligibility),
  );
  if (
    options.requireCurrentEligibility &&
    (!eligibility?.eligible ||
      pass.credentialStatus !== "active" ||
      !consentCurrent ||
      !snapshotCurrent)
  ) {
    throw new WalletPassServiceError(
      pass.credentialStatus === "revoked"
        ? "wallet_pass_revoked"
        : !consentCurrent
          ? "wallet_ineligible"
          : eligibility?.eligible && !snapshotCurrent
            ? "wallet_pass_snapshot_outdated"
            : "wallet_ineligible",
      pass.credentialStatus === "revoked"
        ? "폐기된 Apple Wallet 패스입니다."
        : !consentCurrent
          ? "변경된 Wallet 데이터 이용 내용에 다시 동의해 주세요."
          : eligibility?.eligible && !snapshotCurrent
            ? "회원 정보가 변경되었습니다. Apple Wallet 패스를 다시 발급해 주세요."
            : eligibility && !eligibility.eligible
              ? getWalletPassEligibilityMessage(eligibility.reason)
              : "Apple Wallet 패스를 발급할 수 없습니다.",
    );
  }

  const snapshot = readDisplaySnapshot(pass);
  const voided =
    pass.credentialStatus === "revoked" ||
    !consentCurrent ||
    Boolean(eligibility && !eligibility.eligible) ||
    Boolean(eligibility?.eligible && !snapshotCurrent);
  try {
    const buffer = await createAppleWalletPass({
      serialNumber: pass.serialNumber,
      authenticationToken: deriveAppleWalletAuthenticationToken(
        pass.publicId,
        config.passTypeIdentifier,
        config.deviceTokenEncryptionKey,
      ),
      verificationUrl: createWalletPassVerificationUrl(pass.publicId, {
        masterKey: config.deviceTokenEncryptionKey,
        siteUrl: config.siteUrl,
      }),
      ...snapshot,
      updatedAt: pass.updatedAt,
      voided,
    });
    await walletPassRepository
      .markWalletPassSyncSuccess({ passId: pass.id })
      .catch(() => undefined);
    return buffer;
  } catch {
    await walletPassRepository
      .markWalletPassSyncFailure({
        passId: pass.id,
        safeErrorCode: "pass_build_failed",
      })
      .catch(() => undefined);
    throw new WalletPassServiceError(
      "wallet_pass_build_failed",
      "Apple Wallet 패스를 생성하지 못했습니다.",
    );
  }
}

export async function notifyAppleWalletPassChange(
  pass: MemberWalletPass,
  options: {
    sendUpdate?: typeof sendAppleWalletPassUpdate;
  } = {},
) {
  const config = requireAppleWalletConfig();
  const registrations = await walletPassRepository
    .listAppleWalletDeviceRegistrationsForPass(pass.id);
  let tokenReadFailures = 0;
  const tokens = registrations.flatMap((registration) => {
    if (registration.pushTokenKeyVersion !== 1) {
      tokenReadFailures += 1;
      return [];
    }
    try {
      return [
        decryptApplePushToken(
          {
            ciphertext: registration.pushTokenCiphertext,
            iv: registration.pushTokenIv,
            tag: registration.pushTokenAuthTag,
            keyVersion: registration.pushTokenKeyVersion,
          } satisfies EncryptedApplePushToken,
          config.deviceTokenEncryptionKey,
        ),
      ];
    } catch {
      tokenReadFailures += 1;
      return [];
    }
  });
  if (registrations.length === 0) {
    await walletPassRepository.markWalletPassSyncSuccess({ passId: pass.id });
    return { delivered: 0, failed: 0, reasonCodes: [] as string[] };
  }
  if (tokens.length === 0) {
    await walletPassRepository.markWalletPassSyncFailure({
      passId: pass.id,
      safeErrorCode: "push_token_unreadable",
    });
    return {
      delivered: 0,
      failed: tokenReadFailures,
      reasonCodes: ["push_token_unreadable"],
    };
  }
  const result = await (options.sendUpdate ?? sendAppleWalletPassUpdate)(tokens);
  if (result.invalidTokens.length > 0) {
    const invalidTokenSet = new Set(result.invalidTokens);
    await Promise.all(
      registrations.map(async (registration) => {
        try {
          const token = decryptApplePushToken(
            {
              ciphertext: registration.pushTokenCiphertext,
              iv: registration.pushTokenIv,
              tag: registration.pushTokenAuthTag,
              keyVersion: registration.pushTokenKeyVersion,
            },
            config.deviceTokenEncryptionKey,
          );
          if (invalidTokenSet.has(token)) {
            await walletPassRepository.unregisterAppleWalletDevice({
              publicId: pass.publicId,
              deviceLibraryIdentifierHash:
                registration.deviceLibraryIdentifierHash,
            });
          }
        } catch {
          return;
        }
      }),
    );
  }
  const combinedResult = {
    ...result,
    failed: result.failed + tokenReadFailures,
    reasonCodes: tokenReadFailures
      ? [...new Set([...result.reasonCodes, "push_token_unreadable"])]
      : result.reasonCodes,
  };
  const unresolvedFailureCount = Math.max(
    0,
    result.failed - result.invalidTokens.length + tokenReadFailures,
  );
  if (unresolvedFailureCount > 0) {
    await walletPassRepository.markWalletPassSyncFailure({
      passId: pass.id,
      safeErrorCode: combinedResult.reasonCodes[0] ?? "push_failed",
    });
  } else {
    await walletPassRepository.markWalletPassSyncSuccess({ passId: pass.id });
  }
  return combinedResult;
}

export async function reconcileInstalledAppleWalletPasses(
  options: {
    batchSize?: number;
    maxPasses?: number;
    notifyPassChange?: typeof notifyAppleWalletPassChange;
    configStatus?: AppleWalletConfigStatus;
  } = {},
): Promise<ReconcileInstalledAppleWalletPassesResult> {
  const configStatus = options.configStatus ?? getAppleWalletConfigStatus();
  const configObservability = summarizeAppleWalletConfigObservability(
    configStatus,
  );
  if (!configStatus.ok) {
    return {
      skipped: true,
      scanned: 0,
      invalidated: 0,
      failed: 0,
      truncated: false,
      ...configObservability,
    };
  }

  const batchSize = Math.max(1, Math.min(options.batchSize ?? 50, 100));
  const maxPasses = Math.max(1, Math.min(options.maxPasses ?? 500, 1_000));
  const notifyPassChange = options.notifyPassChange ?? notifyAppleWalletPassChange;
  let afterPassId: string | null = null;
  let scanned = 0;
  let invalidated = 0;
  let failed = 0;
  let lastBatchWasFull = false;

  while (scanned < maxPasses) {
    const pageLimit = Math.min(batchSize, maxPasses - scanned);
    const passes = await walletPassRepository.listAppleWalletPassesForReconciliation({
      afterPassId,
      limit: pageLimit,
    });
    lastBatchWasFull = passes.length === pageLimit;
    if (passes.length === 0) break;

    for (const pass of passes) {
      scanned += 1;
      afterPassId = pass.id;
      try {
        if (pass.credentialStatus === "revoked") {
          await notifyPassChange(pass);
          continue;
        }
        const eligibility = await getMemberWalletPassEligibility(pass.memberId);
        const consentCurrent =
          pass.consentVersion === APPLE_WALLET_CONSENT_VERSION;
        const contentCurrent =
          consentCurrent && isWalletPassSnapshotCurrent(pass, eligibility);
        if (contentCurrent) {
          if (pass.syncStatus !== "synced") {
            await notifyPassChange(pass);
          }
          continue;
        }

        let pendingPass: MemberWalletPass;
        if (eligibility.eligible && consentCurrent) {
          const snapshot = buildWalletPassDisplaySnapshot(eligibility.member);
          pendingPass = await walletPassRepository.reconcileWalletPassContent({
            passId: pass.id,
            action: "refresh",
            snapshot,
            snapshotHash: hashWalletPassDisplaySnapshot(snapshot),
          });
        } else {
          pendingPass = await walletPassRepository.reconcileWalletPassContent({
            passId: pass.id,
            action: "invalidate",
          });
        }
        await notifyPassChange(pendingPass);
        invalidated += 1;
      } catch {
        failed += 1;
      }
    }

    if (passes.length < pageLimit) break;
  }

  return {
    skipped: false,
    scanned,
    invalidated,
    failed,
    truncated: scanned >= maxPasses && lastBatchWasFull,
    ...configObservability,
  };
}

export function getAppleWalletPassLastModified(pass: MemberWalletPass) {
  return new Date(pass.updatedAt).toUTCString();
}
