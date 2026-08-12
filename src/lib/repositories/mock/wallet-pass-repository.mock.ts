import { randomBytes, randomUUID } from "node:crypto";
import {
  getMockMemberById,
} from "@/lib/mock/member";
import type {
  AppleWalletDeviceRegistration,
  IssueMemberWalletPassInput,
  IssueMemberWalletPassResult,
  MemberWalletPass,
  MemberWalletPassRevision,
  ReconcileWalletPassContentInput,
  RegisterAppleWalletDeviceInput,
  RegisterAppleWalletDeviceResult,
  RevokeMemberWalletPassInput,
  RevokeMemberWalletPassResult,
  UnregisterAppleWalletDeviceInput,
  UnregisterAppleWalletDeviceResult,
  UpdatedAppleWalletPass,
  WalletPassPlatform,
  WalletPassRepository,
} from "@/lib/repositories/wallet-pass-repository";

type OperationRecord = {
  operation: "issue" | "revoke";
  memberId: string;
  platform: WalletPassPlatform;
  requestFingerprint: string;
  resultPassId: string;
  resultRevision: number;
};

function toIsoNow() {
  return new Date().toISOString();
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertMockMemberActive(memberId: string) {
  const member = getMockMemberById(memberId);
  if (!member) {
    throw new Error("member_wallet_pass_member_not_found");
  }
  if (member.mustChangePassword) {
    throw new Error("member_wallet_pass_member_password_change_required");
  }
  return member;
}

function assertMockMemberExists(memberId: string) {
  const member = getMockMemberById(memberId);
  if (!member) {
    throw new Error("member_wallet_pass_member_not_found");
  }
  return member;
}

function createPublicId() {
  return randomBytes(32).toString("base64url");
}

function createSerialNumber(publicId: string) {
  return `sp-${publicId}`;
}

const WALLET_PASS_SNAPSHOT_KEYS = [
  "campusLabel",
  "displayName",
  "generationLabel",
  "roleLabel",
] as const;

function assertWalletPassSnapshot(snapshot: Record<string, unknown>) {
  const keys = Object.keys(snapshot).sort();
  if (
    keys.length !== WALLET_PASS_SNAPSHOT_KEYS.length ||
    keys.some((key, index) => key !== WALLET_PASS_SNAPSHOT_KEYS[index]) ||
    WALLET_PASS_SNAPSHOT_KEYS.some((key) => typeof snapshot[key] !== "string")
  ) {
    throw new Error("member_wallet_pass_snapshot_invalid");
  }
}

export class MockWalletPassRepository implements WalletPassRepository {
  private readonly passes = new Map<string, MemberWalletPass>();
  private readonly revisions = new Map<string, MemberWalletPassRevision[]>();
  private readonly registrations = new Map<string, AppleWalletDeviceRegistration[]>();
  private readonly operations = new Map<string, OperationRecord>();

  async getWalletPassByPublicId(publicId: string) {
    const pass = [...this.passes.values()].find(
      (candidate) => candidate.publicId === publicId,
    );
    return pass ? cloneRecord(pass) : null;
  }

  async getAppleWalletPassBySerialNumber(serialNumber: string) {
    const pass = [...this.passes.values()].find(
      (candidate) =>
        candidate.platform === "apple" && candidate.serialNumber === serialNumber,
    );
    return pass ? cloneRecord(pass) : null;
  }

  async getMemberWalletPass(input: {
    memberId: string;
    platform: WalletPassPlatform;
  }) {
    const pass = [...this.passes.values()]
      .filter(
        (candidate) =>
          candidate.memberId === input.memberId && candidate.platform === input.platform,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    return pass ? cloneRecord(pass) : null;
  }

  async listAppleWalletDeviceRegistrationsForPass(passId: string) {
    return cloneRecord(
      (this.registrations.get(passId) ?? []).filter(
        (candidate) => candidate.removedAt === null,
      ),
    );
  }

  async listAppleWalletPassesForReconciliation(input: {
    afterPassId?: string | null;
    limit: number;
  }) {
    return cloneRecord(
      [...this.passes.values()]
        .filter(
          (pass) =>
            pass.platform === "apple" &&
            pass.installationStatus === "installed" &&
            (pass.credentialStatus === "active" || pass.syncStatus !== "synced") &&
            (!input.afterPassId || pass.id > input.afterPassId),
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .slice(0, Math.max(1, input.limit)),
    );
  }

  async issueMemberWalletPass(
    input: IssueMemberWalletPassInput,
  ): Promise<IssueMemberWalletPassResult> {
    const member = assertMockMemberActive(input.memberId);
    assertWalletPassSnapshot(input.snapshot);
    const existingOperation = this.operations.get(input.idempotencyKey);
    if (existingOperation) {
      if (
        existingOperation.operation !== "issue" ||
        existingOperation.memberId !== input.memberId ||
        existingOperation.platform !== input.platform ||
        existingOperation.requestFingerprint !== input.requestFingerprint
      ) {
        throw new Error("member_wallet_pass_idempotency_conflict");
      }
      const existingPass = this.passes.get(existingOperation.resultPassId);
      const existingRevision = this.revisions
        .get(existingOperation.resultPassId)
        ?.find((candidate) => candidate.revision === existingOperation.resultRevision);
      if (!existingPass || !existingRevision) {
        throw new Error("member_wallet_pass_operation_result_missing");
      }
      return {
        pass: cloneRecord(existingPass),
        revision: cloneRecord(existingRevision),
        isNewPass: false,
        isNewRevision: false,
        operationCreated: false,
      };
    }

    const now = toIsoNow();
    const activePass = [...this.passes.values()].find(
      (candidate) =>
        candidate.memberId === member.id &&
        candidate.platform === input.platform &&
        candidate.credentialStatus === "active",
    );

    let pass: MemberWalletPass;
    let revision: MemberWalletPassRevision;
    let isNewPass = false;
    let isNewRevision = false;

    if (!activePass) {
      const publicId = createPublicId();
      pass = {
        id: randomUUID(),
        memberId: member.id,
        platform: input.platform,
        publicId,
        serialNumber: createSerialNumber(publicId),
        credentialStatus: "active",
        installationStatus: "pending",
        syncStatus: "pending",
        consentVersion: input.consentVersion,
        consentedAt: input.consentedAt,
        currentRevision: 1,
        currentSnapshotHash: input.snapshotHash,
        currentSnapshot: cloneRecord(input.snapshot),
        issuedAt: now,
        revokedAt: null,
        lastSyncAttemptedAt: null,
        lastSyncedAt: null,
        lastSyncErrorCode: null,
        lastSyncErrorAt: null,
        createdAt: now,
        updatedAt: now,
      };
      revision = {
        id: randomUUID(),
        passId: pass.id,
        revision: 1,
        snapshotHash: input.snapshotHash,
        snapshot: cloneRecord(input.snapshot),
        consentVersion: input.consentVersion,
        consentedAt: input.consentedAt,
        issuedAt: now,
        createdAt: now,
      };
      this.passes.set(pass.id, pass);
      this.revisions.set(pass.id, [revision]);
      isNewPass = true;
      isNewRevision = true;
    } else {
      pass = activePass;
      const unchanged =
        pass.currentSnapshotHash === input.snapshotHash &&
        JSON.stringify(pass.currentSnapshot) === JSON.stringify(input.snapshot) &&
        pass.consentVersion === input.consentVersion &&
        pass.consentedAt === input.consentedAt;
      if (!unchanged) {
        const nextRevision = pass.currentRevision + 1;
        pass = {
          ...pass,
          consentVersion: input.consentVersion,
          consentedAt: input.consentedAt,
          currentRevision: nextRevision,
          currentSnapshotHash: input.snapshotHash,
          currentSnapshot: cloneRecord(input.snapshot),
          issuedAt: now,
          revokedAt: null,
          syncStatus: "pending",
          lastSyncErrorCode: null,
          lastSyncErrorAt: null,
          updatedAt: now,
        };
        revision = {
          id: randomUUID(),
          passId: pass.id,
          revision: nextRevision,
          snapshotHash: input.snapshotHash,
          snapshot: cloneRecord(input.snapshot),
          consentVersion: input.consentVersion,
          consentedAt: input.consentedAt,
          issuedAt: now,
          createdAt: now,
        };
        this.passes.set(pass.id, pass);
        this.revisions.set(pass.id, [...(this.revisions.get(pass.id) ?? []), revision]);
        isNewRevision = true;
      } else {
        const currentRevision = this.revisions
          .get(pass.id)
          ?.find((candidate) => candidate.revision === pass.currentRevision);
        if (!currentRevision) {
          throw new Error("member_wallet_pass_revision_missing");
        }
        revision = currentRevision;
      }
    }

    this.operations.set(input.idempotencyKey, {
      operation: "issue",
      memberId: input.memberId,
      platform: input.platform,
      requestFingerprint: input.requestFingerprint,
      resultPassId: pass.id,
      resultRevision: revision.revision,
    });

    return {
      pass: cloneRecord(pass),
      revision: cloneRecord(revision),
      isNewPass,
      isNewRevision,
      operationCreated: true,
    };
  }

  async revokeMemberWalletPass(
    input: RevokeMemberWalletPassInput,
  ): Promise<RevokeMemberWalletPassResult> {
    assertMockMemberExists(input.memberId);
    const existingOperation = this.operations.get(input.idempotencyKey);
    if (existingOperation) {
      if (
        existingOperation.operation !== "revoke" ||
        existingOperation.memberId !== input.memberId ||
        existingOperation.platform !== input.platform ||
        existingOperation.requestFingerprint !== input.requestFingerprint
      ) {
        throw new Error("member_wallet_pass_idempotency_conflict");
      }
      const pass = this.passes.get(existingOperation.resultPassId);
      if (!pass) {
        throw new Error("member_wallet_pass_operation_result_missing");
      }
      return {
        pass: cloneRecord(pass),
        alreadyRevoked: pass.credentialStatus === "revoked",
        operationCreated: false,
      };
    }

    const pass = [...this.passes.values()]
      .filter(
        (candidate) =>
          candidate.memberId === input.memberId && candidate.platform === input.platform,
      )
      .sort((left, right) => {
        if (left.credentialStatus !== right.credentialStatus) {
          return left.credentialStatus === "active" ? -1 : 1;
        }
        return right.createdAt.localeCompare(left.createdAt);
      })[0];
    if (!pass) {
      throw new Error("member_wallet_pass_not_found");
    }

    const alreadyRevoked = pass.credentialStatus === "revoked";
    const nextPass = alreadyRevoked
      ? pass
      : {
          ...pass,
          credentialStatus: "revoked" as const,
          syncStatus: "pending" as const,
          revokedAt: toIsoNow(),
          lastSyncErrorCode: null,
          lastSyncErrorAt: null,
          updatedAt: toIsoNow(),
        };
    this.passes.set(pass.id, nextPass);
    this.operations.set(input.idempotencyKey, {
      operation: "revoke",
      memberId: input.memberId,
      platform: input.platform,
      requestFingerprint: input.requestFingerprint,
      resultPassId: nextPass.id,
      resultRevision: nextPass.currentRevision,
    });

    return {
      pass: cloneRecord(nextPass),
      alreadyRevoked,
      operationCreated: true,
    };
  }

  async registerAppleWalletDevice(
    input: RegisterAppleWalletDeviceInput,
  ): Promise<RegisterAppleWalletDeviceResult> {
    const pass = [...this.passes.values()].find(
      (candidate) => candidate.publicId === input.publicId && candidate.platform === "apple",
    );
    if (!pass) {
      throw new Error("member_wallet_pass_not_found");
    }
    if (pass.credentialStatus !== "active") {
      throw new Error("member_wallet_pass_revoked");
    }

    const existingRegistrations = this.registrations.get(pass.id) ?? [];
    const existing = existingRegistrations.find(
      (candidate) =>
        candidate.deviceLibraryIdentifierHash === input.deviceLibraryIdentifierHash,
    );
    const now = toIsoNow();
    const registration: AppleWalletDeviceRegistration = existing
      ? {
          ...existing,
          pushTokenCiphertext: input.pushTokenCiphertext,
          pushTokenIv: input.pushTokenIv,
          pushTokenAuthTag: input.pushTokenAuthTag,
          pushTokenKeyVersion: input.pushTokenKeyVersion,
          lastRegisteredAt: now,
          removedAt: null,
          updatedAt: now,
        }
      : {
          id: randomUUID(),
          passId: pass.id,
          deviceLibraryIdentifierHash: input.deviceLibraryIdentifierHash,
          pushTokenCiphertext: input.pushTokenCiphertext,
          pushTokenIv: input.pushTokenIv,
          pushTokenAuthTag: input.pushTokenAuthTag,
          pushTokenKeyVersion: input.pushTokenKeyVersion,
          lastRegisteredAt: now,
          removedAt: null,
          createdAt: now,
          updatedAt: now,
        };
    this.registrations.set(
      pass.id,
      existing
        ? existingRegistrations.map((candidate) =>
            candidate.id === registration.id ? registration : candidate,
          )
        : [...existingRegistrations, registration],
    );
    const nextPass: MemberWalletPass = {
      ...pass,
      installationStatus: "installed",
      updatedAt: now,
    };
    this.passes.set(pass.id, nextPass);

    return {
      pass: cloneRecord(nextPass),
      registration: cloneRecord(registration),
      isNewRegistration: !existing,
    };
  }

  async unregisterAppleWalletDevice(
    input: UnregisterAppleWalletDeviceInput,
  ): Promise<UnregisterAppleWalletDeviceResult> {
    const pass = [...this.passes.values()].find(
      (candidate) => candidate.publicId === input.publicId && candidate.platform === "apple",
    );
    if (!pass) {
      throw new Error("member_wallet_pass_not_found");
    }
    const existingRegistrations = this.registrations.get(pass.id) ?? [];
    const now = toIsoNow();
    let removed = false;
    const nextRegistrations = existingRegistrations.map((candidate) => {
      if (
        candidate.deviceLibraryIdentifierHash === input.deviceLibraryIdentifierHash &&
        candidate.removedAt === null
      ) {
        removed = true;
        return {
          ...candidate,
          removedAt: now,
          updatedAt: now,
        };
      }
      return candidate;
    });
    this.registrations.set(pass.id, nextRegistrations);
    const hasActiveRegistration = nextRegistrations.some(
      (candidate) => candidate.removedAt === null,
    );
    const nextPass: MemberWalletPass = {
      ...pass,
      installationStatus: hasActiveRegistration ? "installed" : "removed",
      updatedAt: now,
    };
    this.passes.set(pass.id, nextPass);

    return {
      pass: cloneRecord(nextPass),
      removed,
    };
  }

  async listUpdatedAppleWalletPasses(input: {
    deviceLibraryIdentifierHash: string;
    updatedSince?: string | null;
    limit: number;
  }): Promise<UpdatedAppleWalletPass[]> {
    const threshold = input.updatedSince
      ? new Date(input.updatedSince).getTime()
      : Number.NEGATIVE_INFINITY;
    return [...this.passes.values()]
      .filter((pass) => {
        const passUpdatedAt = new Date(pass.updatedAt).getTime();
        const registrations = (this.registrations.get(pass.id) ?? []).filter(
          (candidate) =>
            candidate.removedAt === null &&
            candidate.deviceLibraryIdentifierHash ===
              input.deviceLibraryIdentifierHash,
        );
        return (
          pass.platform === "apple" &&
          registrations.length > 0 &&
          passUpdatedAt > threshold
        );
      })
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
      .slice(0, Math.max(1, input.limit))
      .map((pass) => ({
        pass: cloneRecord(pass),
        registrations: cloneRecord(
          (this.registrations.get(pass.id) ?? []).filter(
            (registration) =>
              registration.removedAt === null &&
              registration.deviceLibraryIdentifierHash ===
                input.deviceLibraryIdentifierHash,
          ),
        ),
      }));
  }

  async markWalletPassSyncSuccess(input: {
    passId: string;
    syncedAt?: string | null;
  }) {
    const pass = this.passes.get(input.passId);
    if (!pass) {
      throw new Error("member_wallet_pass_not_found");
    }
    const timestamp = input.syncedAt ?? toIsoNow();
    const nextPass: MemberWalletPass = {
      ...pass,
      syncStatus: "synced",
      lastSyncAttemptedAt: timestamp,
      lastSyncedAt: timestamp,
      lastSyncErrorCode: null,
      lastSyncErrorAt: null,
    };
    this.passes.set(pass.id, nextPass);
    return cloneRecord(nextPass);
  }

  async markWalletPassSyncFailure(input: {
    passId: string;
    safeErrorCode: string;
    attemptedAt?: string | null;
  }) {
    const pass = this.passes.get(input.passId);
    if (!pass) {
      throw new Error("member_wallet_pass_not_found");
    }
    const timestamp = input.attemptedAt ?? toIsoNow();
    const nextPass: MemberWalletPass = {
      ...pass,
      syncStatus: "failed",
      lastSyncAttemptedAt: timestamp,
      lastSyncErrorCode: input.safeErrorCode,
      lastSyncErrorAt: timestamp,
    };
    this.passes.set(pass.id, nextPass);
    return cloneRecord(nextPass);
  }

  async reconcileWalletPassContent(input: ReconcileWalletPassContentInput) {
    const pass = this.passes.get(input.passId);
    if (!pass || pass.credentialStatus !== "active") {
      throw new Error("member_wallet_pass_not_found");
    }
    const changedAt = input.changedAt ?? toIsoNow();
    if (input.action === "invalidate") {
      const invalidatedPass: MemberWalletPass = {
        ...pass,
        credentialStatus: "revoked",
        syncStatus: "pending",
        revokedAt: changedAt,
        lastSyncErrorCode: null,
        lastSyncErrorAt: null,
        updatedAt: changedAt,
      };
      this.passes.set(pass.id, invalidatedPass);
      return cloneRecord(invalidatedPass);
    }

    assertWalletPassSnapshot(input.snapshot);
    const snapshotUnchanged =
      pass.currentSnapshotHash === input.snapshotHash &&
      JSON.stringify(pass.currentSnapshot) === JSON.stringify(input.snapshot);
    if (snapshotUnchanged) {
      return cloneRecord(pass);
    }

    const nextRevision = pass.currentRevision + 1;
    const nextPass: MemberWalletPass = {
      ...pass,
      currentRevision: nextRevision,
      currentSnapshotHash: input.snapshotHash,
      currentSnapshot: cloneRecord(input.snapshot),
      issuedAt: changedAt,
      syncStatus: "pending",
      lastSyncErrorCode: null,
      lastSyncErrorAt: null,
      updatedAt: changedAt,
    };
    const revision: MemberWalletPassRevision = {
      id: randomUUID(),
      passId: pass.id,
      revision: nextRevision,
      snapshotHash: input.snapshotHash,
      snapshot: cloneRecord(input.snapshot),
      consentVersion: pass.consentVersion,
      consentedAt: pass.consentedAt,
      issuedAt: changedAt,
      createdAt: changedAt,
    };
    this.passes.set(pass.id, nextPass);
    this.revisions.set(pass.id, [
      ...(this.revisions.get(pass.id) ?? []),
      revision,
    ]);
    return cloneRecord(nextPass);
  }
}
