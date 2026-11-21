import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportRow, ManualMemberImportCommitItem } from "@/lib/member-manual-import/types";
const mocks = vi.hoisted(() => ({
  findBatch: vi.fn(), claimBatch: vi.fn(), hasLease: vi.fn(), refresh: vi.fn(),
  pendingRows: vi.fn(), claimRow: vi.fn(), processRow: vi.fn(), requeueRow: vi.fn(),
  release: vi.fn(), interrupted: vi.fn(), cleanupRows: vi.fn(), resultRows: vi.fn(),
  resultItem: vi.fn(), complete: vi.fn(), removeFile: vi.fn(), stagingDeleted: vi.fn(),
}));
vi.mock("@/lib/ssafy-cycle-settings", () => ({ getConfiguredCurrentSsafyYear: () => 16, getSsafyCycleSettings: async () => ({}) }));
vi.mock("@/lib/member-manual-import/password-actions.server", () => ({ completeManualMemberPasswordAction: vi.fn(), issueManualMemberPasswordReset: vi.fn() }));
vi.mock("@/lib/member-manual-import/reissue.server", () => ({ reissueManualMemberImportSetup: vi.fn() }));
vi.mock("@/lib/member-manual-import/photo.server", () => ({ prepareManualMemberImportRows: vi.fn(), removeStagingFile: mocks.removeFile }));
vi.mock("@/lib/member-manual-import/row.server", () => ({ processImportRow: mocks.processRow, toManualMemberImportCommitItem: mocks.resultItem }));
vi.mock("@/lib/member-manual-import/repository.supabase", () => ({
  findManualMemberImportBatch: mocks.findBatch, claimManualMemberImportBatch: mocks.claimBatch,
  hasManualMemberImportBatchLease: mocks.hasLease, refreshManualMemberImportBatchLease: mocks.refresh,
  listManualMemberImportPendingRows: mocks.pendingRows, claimManualMemberImportRow: mocks.claimRow,
  requeueManualMemberImportActiveRow: mocks.requeueRow, releaseManualMemberImportBatchLease: mocks.release,
  requeueManualMemberImportInterruptedRows: mocks.interrupted, listManualMemberImportStagingCleanupRows: mocks.cleanupRows,
  listManualMemberImportResultRows: mocks.resultRows, completeManualMemberImportBatch: mocks.complete,
  markManualMemberImportStagingDeleted: mocks.stagingDeleted,
}));
import { commitManualMemberImport } from "@/lib/member-manual-import/service.server";
const input = { batchId: "batch", adminId: "owner" };
const row = { id: "row", batch_id: "batch", status: "staged", error_code: null } as ImportRow;
const batch = () => ({ id: "batch", created_by_admin_id: "owner", status: "ready", expires_at: new Date(Date.now() + 60_000).toISOString(), updated_at: "batch-v0" });
const item = { rowNumber: 2, status: "success", name: "테스트 회원", mmId: null, email: "fixture@example.test", deliveryChannel: "email", reason: null, retryable: false, existingMemberId: null } satisfies ManualMemberImportCommitItem;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findBatch.mockImplementation(async () => batch());
  mocks.claimBatch.mockResolvedValue({ id: "batch", updated_at: "batch-v1" });
  mocks.hasLease.mockResolvedValue(true);
  mocks.refresh.mockResolvedValue("batch-v2");
  mocks.pendingRows.mockResolvedValue([row]);
  mocks.claimRow.mockResolvedValue({ id: "row", updated_at: "row-v1" });
  mocks.processRow.mockResolvedValue(item);
  mocks.cleanupRows.mockResolvedValue([]);
  mocks.resultRows.mockResolvedValue([{}]);
  mocks.resultItem.mockResolvedValue(item);
  mocks.stagingDeleted.mockResolvedValue(true);
});

describe("manual import batch orchestration", () => {
  it("does not claim or process a missing owner-scoped batch", async () => {
    mocks.findBatch.mockResolvedValue(null);
    await expect(commitManualMemberImport(input)).rejects.toThrow("배치가 없거나 만료");
    expect(mocks.findBatch).toHaveBeenCalledWith(input);
    expect(mocks.claimBatch).not.toHaveBeenCalled();
    expect(mocks.processRow).not.toHaveBeenCalled();
  });

  it("recovers expired processing rows, filters terminal failures, then completes with the refreshed batch lease", async () => {
    mocks.findBatch.mockResolvedValue({ ...batch(), status: "processing", updated_at: new Date(Date.now() - 16 * 60_000).toISOString() });
    mocks.pendingRows.mockResolvedValue([row, { ...row, id: "unknown", status: "failed", error_code: "delivery_outcome_unknown" }, { ...row, id: "duplicate", status: "failed", error_code: "already_registered" }]);
    expect(await commitManualMemberImport(input)).toMatchObject({ total: 1, success: 1, failed: 0 });
    expect(mocks.interrupted).toHaveBeenCalledWith("batch");
    expect(mocks.claimBatch).toHaveBeenCalledWith(expect.objectContaining({ ...input, isReady: false }));
    expect(mocks.processRow).toHaveBeenCalledTimes(1);
    expect(mocks.complete).toHaveBeenCalledWith({ ...input, processingLeaseVersion: "batch-v2", retryableFailures: 0 });
    expect(mocks.cleanupRows.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.processRow.mock.invocationCallOrder[0]);
  });

  it("requeues the newest active row checkpoint before releasing a batch after interruption", async () => {
    mocks.processRow.mockImplementation(async (_row, _version, onUpdated) => {
      onUpdated("row-v3");
      throw new Error("synthetic interruption");
    });
    await expect(commitManualMemberImport(input)).rejects.toThrow("synthetic interruption");
    expect(mocks.requeueRow).toHaveBeenCalledWith("batch", { id: "row", updated_at: "row-v3" });
    expect(mocks.release).toHaveBeenCalledWith({ ...input, processingLeaseVersion: "batch-v1" });
    expect(mocks.requeueRow.mock.invocationCallOrder[0]).toBeLessThan(mocks.release.mock.invocationCallOrder[0]);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("leaves recovery to the new owner once its batch lease is lost", async () => {
    mocks.hasLease.mockResolvedValue(false);
    await expect(commitManualMemberImport(input)).rejects.toThrow("처리 권한이 만료");
    expect(mocks.claimRow).not.toHaveBeenCalled();
    expect(mocks.requeueRow).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.processRow).not.toHaveBeenCalled();
  });
});
