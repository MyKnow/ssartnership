import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportRow } from "@/lib/member-manual-import/types";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => mocks }));
import * as repository from "@/lib/member-manual-import/repository.supabase";

type Operation = { table: string; calls: Array<[string, ...unknown[]]> };
type Response = { data: unknown; error: unknown };
const row = { id: "row", batch_id: "batch", status: "failed", updated_at: "row-v1", error_code: "delivery_outcome_unknown", delivery_idempotency_key: "manual-member-import-reissue:row:attempt" } as ImportRow;
let operations: Operation[];
let responses: Response[];
const lease = { batchId: "batch", adminId: "admin", processingLeaseVersion: "batch-v1" };

beforeEach(() => {
  operations = [];
  responses = [];
  mocks.rpc.mockReset();
  mocks.from.mockReset().mockImplementation((table: string) => {
    const operation: Operation = { table, calls: [] };
    operations.push(operation);
    const response = responses.shift() ?? { data: { id: "record", updated_at: "v2" }, error: null };
    const query: Record<string, unknown> = {};
    for (const name of ["select", "eq", "is", "in", "gt", "lt", "like", "order", "update", "insert", "delete"]) {
      query[name] = (...args: unknown[]) => { operation.calls.push([name, ...args]); return query; };
    }
    query.maybeSingle = query.single = async () => response;
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
    return query;
  });
});

describe("manual import persistence fencing", () => {
  it("claims ready or expired processing batches only for their owner and before expiry", async () => {
    const input = { batchId: "batch", adminId: "owner", isReady: true, nowIso: "now", processingLeaseExpiredAt: "cutoff" };
    await repository.claimManualMemberImportBatch(input);
    await repository.claimManualMemberImportBatch({ ...input, isReady: false });
    for (const operation of operations) {
      expect(operation.table).toBe("manual_member_import_batches");
      expect(operation.calls).toContainEqual(["eq", "created_by_admin_id", "owner"]);
      expect(operation.calls).toContainEqual(["gt", "expires_at", "now"]);
    }
    expect(operations[0].calls).toContainEqual(["eq", "status", "ready"]);
    expect(operations[0].calls.some(([method]) => method === "lt")).toBe(false);
    expect(operations[1].calls).toContainEqual(["eq", "status", "processing"]);
    expect(operations[1].calls).toContainEqual(["lt", "updated_at", "cutoff"]);
    responses.push({ data: null, error: null });
    await expect(repository.claimManualMemberImportBatch(input)).rejects.toThrow("이미 처리 중이거나");
  });

  it("refreshes, releases and completes only the currently held owner lease", async () => {
    expect(await repository.refreshManualMemberImportBatchLease(lease)).toBe("v2");
    await repository.releaseManualMemberImportBatchLease(lease);
    await repository.completeManualMemberImportBatch({ ...lease, retryableFailures: 1 });
    for (const operation of operations) {
      expect(operation.calls).toContainEqual(["eq", "created_by_admin_id", "admin"]);
      expect(operation.calls).toContainEqual(["eq", "updated_at", "batch-v1"]);
      expect(operation.calls).toContainEqual(["eq", "status", "processing"]);
    }
    expect(operations[2].calls).toContainEqual(["update", { status: "ready", completed_at: null }]);
    responses.push({ data: null, error: null });
    await expect(repository.refreshManualMemberImportBatchLease(lease)).rejects.toThrow("갱신하지 못했습니다");
  });

  it("returns each row checkpoint version and never writes through a stale lease", async () => {
    const input = { row, rowLeaseVersion: "row-v1", deliveryChannel: "email" as const, deliveryIdempotencyKey: "stable-key" };
    expect(await repository.checkpointManualMemberImportDeliveryIntent(input)).toEqual({ rowLeaseVersion: "v2", deliveryIdempotencyKey: "stable-key" });
    await repository.checkpointManualMemberImportDeliveryAttempt(input);
    await repository.checkpointManualMemberImportDeliverySent(input);
    await repository.checkpointManualMemberImportPhotoAttachment(input);
    await repository.requeueManualMemberImportActiveRow("batch", { id: "row", updated_at: "row-v1" });
    for (const operation of operations) {
      expect(operation.calls).toContainEqual(["eq", "id", "row"]);
      expect(operation.calls).toContainEqual(["eq", "batch_id", "batch"]);
      expect(operation.calls).toContainEqual(["eq", "updated_at", "row-v1"]);
      expect(operation.calls).toContainEqual(["eq", "status", "processing"]);
    }
    responses.push({ data: null, error: null });
    await expect(repository.checkpointManualMemberImportDeliverySent(input)).rejects.toThrow("전송 상태를 저장하지 못했습니다");
  });

  it("reclaims only expired reissue attempts using both prior version and delivery-key prefix", async () => {
    expect(await repository.reclaimExpiredManualMemberImportReissueLease({ row, processingLeaseExpiredAt: "cutoff" })).toBeNull();
    expect(operations).toHaveLength(0);
    await repository.reclaimExpiredManualMemberImportReissueLease({ row: { ...row, status: "processing" }, processingLeaseExpiredAt: "cutoff" });
    expect(operations[0].calls).toContainEqual(["eq", "updated_at", "row-v1"]);
    expect(operations[0].calls).toContainEqual(["lt", "updated_at", "cutoff"]);
    expect(operations[0].calls).toContainEqual(["like", "delivery_idempotency_key", "manual-member-import-reissue:%"]);
    expect(operations[0].calls).toContainEqual(["update", expect.objectContaining({ status: "failed", error_code: "delivery_outcome_unknown" })]);
  });

  it("compensates failed row inserts and reports compensation failure before marking ready", async () => {
    responses.push({ data: null, error: {} }, { data: null, error: {} });
    await expect(repository.saveManualMemberImportRows("batch", [])).rejects.toThrow("배치를 정리하지 못했습니다");
    expect(operations).toHaveLength(2);
    expect(operations[1]).toEqual({ table: "manual_member_import_batches", calls: [["delete"], ["eq", "id", "batch"]] });
    operations = [];
    responses.push({ data: null, error: null }, { data: null, error: {} });
    await expect(repository.saveManualMemberImportRows("batch", [])).rejects.toThrow("준비로 전환하지 못했습니다");
    expect(operations[1].calls).toContainEqual(["update", { status: "ready" }]);
  });

  it("keeps a duplicate lookup scoped to an active member and exposes the existing member id", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "existing_email" } });
    responses.push({ data: { id: "existing" }, error: null });
    await expect(repository.checkpointManualMemberImportMember({ row: { ...row, email_normalized: "fixture@example.test" }, rowLeaseVersion: "row-v1", displayName: "테스트", campus: "서울", mattermostAccountId: null, staffSourceGeneration: null })).rejects.toMatchObject({ memberId: "existing" });
    expect(operations[0].calls).toContainEqual(["eq", "email_normalized", "fixture@example.test"]);
    expect(operations[0].calls).toContainEqual(["is", "deleted_at", null]);
    expect(mocks.rpc).toHaveBeenCalledWith("checkpoint_manual_member_import_member", expect.objectContaining({ p_expected_row_updated_at: "row-v1", p_batch_id: "batch", p_row_id: "row" }));
  });
});
