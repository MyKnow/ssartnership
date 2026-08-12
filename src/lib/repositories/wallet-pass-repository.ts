export type WalletPassPlatform = "apple";

export type WalletPassCredentialStatus = "active" | "revoked";
export type WalletPassInstallationStatus = "pending" | "installed" | "removed";
export type WalletPassSyncStatus = "pending" | "synced" | "failed";

export type MemberWalletPass = {
  id: string;
  memberId: string;
  platform: WalletPassPlatform;
  publicId: string;
  serialNumber: string;
  credentialStatus: WalletPassCredentialStatus;
  installationStatus: WalletPassInstallationStatus;
  syncStatus: WalletPassSyncStatus;
  consentVersion: number;
  consentedAt: string;
  currentRevision: number;
  currentSnapshotHash: string;
  currentSnapshot: Record<string, unknown>;
  issuedAt: string;
  revokedAt: string | null;
  lastSyncAttemptedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncErrorCode: string | null;
  lastSyncErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberWalletPassRevision = {
  id: string;
  passId: string;
  revision: number;
  snapshotHash: string;
  snapshot: Record<string, unknown>;
  consentVersion: number;
  consentedAt: string;
  issuedAt: string;
  createdAt: string;
};

export type AppleWalletDeviceRegistration = {
  id: string;
  passId: string;
  deviceLibraryIdentifierHash: string;
  pushTokenCiphertext: string;
  pushTokenIv: string;
  pushTokenAuthTag: string;
  pushTokenKeyVersion: number;
  lastRegisteredAt: string;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssueMemberWalletPassInput = {
  memberId: string;
  platform: WalletPassPlatform;
  consentVersion: number;
  consentedAt: string;
  snapshotHash: string;
  snapshot: Record<string, unknown>;
  idempotencyKey: string;
  requestFingerprint: string;
};

export type IssueMemberWalletPassResult = {
  pass: MemberWalletPass;
  revision: MemberWalletPassRevision;
  isNewPass: boolean;
  isNewRevision: boolean;
  operationCreated: boolean;
};

export type RevokeMemberWalletPassInput = {
  memberId: string;
  platform: WalletPassPlatform;
  idempotencyKey: string;
  requestFingerprint: string;
  reason: string;
};

export type RevokeMemberWalletPassResult = {
  pass: MemberWalletPass;
  alreadyRevoked: boolean;
  operationCreated: boolean;
};

export type RegisterAppleWalletDeviceInput = {
  publicId: string;
  deviceLibraryIdentifierHash: string;
  pushTokenCiphertext: string;
  pushTokenIv: string;
  pushTokenAuthTag: string;
  pushTokenKeyVersion: number;
};

export type RegisterAppleWalletDeviceResult = {
  pass: MemberWalletPass;
  registration: AppleWalletDeviceRegistration;
  isNewRegistration: boolean;
};

export type UnregisterAppleWalletDeviceInput = {
  publicId: string;
  deviceLibraryIdentifierHash: string;
};

export type UnregisterAppleWalletDeviceResult = {
  pass: MemberWalletPass;
  removed: boolean;
};

export type UpdatedAppleWalletPass = {
  pass: MemberWalletPass;
  registrations: AppleWalletDeviceRegistration[];
};

export type ReconcileWalletPassContentInput =
  | {
      passId: string;
      action: "refresh";
      snapshotHash: string;
      snapshot: Record<string, unknown>;
      changedAt?: string | null;
    }
  | {
      passId: string;
      action: "invalidate";
      changedAt?: string | null;
    };

export interface WalletPassRepository {
  getWalletPassByPublicId(publicId: string): Promise<MemberWalletPass | null>;
  getAppleWalletPassBySerialNumber(
    serialNumber: string,
  ): Promise<MemberWalletPass | null>;
  getMemberWalletPass(input: {
    memberId: string;
    platform: WalletPassPlatform;
  }): Promise<MemberWalletPass | null>;
  listAppleWalletDeviceRegistrationsForPass(
    passId: string,
  ): Promise<AppleWalletDeviceRegistration[]>;
  listAppleWalletPassesForReconciliation(input: {
    afterPassId?: string | null;
    limit: number;
  }): Promise<MemberWalletPass[]>;
  issueMemberWalletPass(
    input: IssueMemberWalletPassInput,
  ): Promise<IssueMemberWalletPassResult>;
  revokeMemberWalletPass(
    input: RevokeMemberWalletPassInput,
  ): Promise<RevokeMemberWalletPassResult>;
  registerAppleWalletDevice(
    input: RegisterAppleWalletDeviceInput,
  ): Promise<RegisterAppleWalletDeviceResult>;
  unregisterAppleWalletDevice(
    input: UnregisterAppleWalletDeviceInput,
  ): Promise<UnregisterAppleWalletDeviceResult>;
  listUpdatedAppleWalletPasses(input: {
    deviceLibraryIdentifierHash: string;
    updatedSince?: string | null;
    limit: number;
  }): Promise<UpdatedAppleWalletPass[]>;
  markWalletPassSyncSuccess(input: {
    passId: string;
    syncedAt?: string | null;
  }): Promise<MemberWalletPass>;
  markWalletPassSyncFailure(input: {
    passId: string;
    safeErrorCode: string;
    attemptedAt?: string | null;
  }): Promise<MemberWalletPass>;
  reconcileWalletPassContent(
    input: ReconcileWalletPassContentInput,
  ): Promise<MemberWalletPass>;
}
