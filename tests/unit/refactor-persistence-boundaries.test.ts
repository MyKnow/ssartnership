import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), remove: vi.fn(), createClient: vi.fn(() => ({ marker: "real" })) }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/graduate-verification-storage", () => ({ removeGraduateStoredObject: mocks.remove }));

describe("admin client source boundary", () => {
  beforeEach(() => { vi.resetModules(); mocks.createClient.mockClear(); vi.stubEnv("SUPABASE_URL", "https://synthetic.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key"); });
  it("rejects mock mode before creating a credentialed SDK client", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock"); vi.stubEnv("NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE", "mock");
    const { getSupabaseAdminClient } = await import("@/lib/supabase/server");
    expect(() => getSupabaseAdminClient()).toThrowError("데이터 저장소를 사용할 수 없습니다.");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("supports a real partner portal independently of a mock public catalog", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock"); vi.stubEnv("NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE", "supabase");
    const { getSupabaseAdminClient } = await import("@/lib/supabase/server");
    expect(getSupabaseAdminClient()).toEqual({ marker: "real" });
    expect(getSupabaseAdminClient()).toEqual({ marker: "real" });
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });
});

describe("private file retention", () => {
  let rows: Record<string, unknown[]>;
  let operations: Array<{ table: string; calls: Array<[string, ...unknown[]]> }>;
  beforeEach(() => {
    vi.resetModules(); operations = []; rows = {}; mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.from.mockReset().mockImplementation((table: string) => {
      const calls: Array<[string, ...unknown[]]> = [];
      operations.push({ table, calls });
      const query: Record<string, unknown> = {};
      for (const name of ["select", "is", "lt", "lte", "limit", "not", "in", "eq", "delete", "update", "insert"]) query[name] = (...args: unknown[]) => { calls.push([name, ...args]); return query; };
      query.single = async () => ({ data: { id: "image" }, error: null });
      query.maybeSingle = async () => ({ data: rows[table]?.[0] ?? null, error: null });
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      return query;
    });
    vi.doMock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({ from: mocks.from }) }));
  });
  it("uses the supplied clock, exact 24-hour quarantine cutoff, and only expired private records", async () => {
    const { purgeExpiredGraduateVerificationFiles } = await import("@/lib/graduate-verification-retention.server");
    const result = await purgeExpiredGraduateVerificationFiles(new Date("2026-10-05T12:00:00Z"));
    expect(result).toEqual({ quarantinedUploads: { deleted: 0, failed: 0 }, certificates: { deleted: 0, failed: 0 }, profileImages: { deleted: 0, failed: 0 } });
    expect(operations[0].calls).toContainEqual(["is", "consumed_at", null]);
    expect(operations[0].calls).toContainEqual(["lt", "created_at", "2026-10-04T12:00:00.000Z"]);
    expect(operations[1].calls).toContainEqual(["lte", "certificate_delete_after", "2026-10-05T12:00:00.000Z"]);
    expect(operations[2].calls).toContainEqual(["in", "status", ["rejected", "superseded"]]);
    expect(operations[2].calls).toContainEqual(["lte", "delete_after", "2026-10-05T12:00:00.000Z"]);
    expect(mocks.remove).not.toHaveBeenCalled();
    await expect(purgeExpiredGraduateVerificationFiles(new Date(NaN))).rejects.toThrow("GRADUATE_CLEANUP_TIME_INVALID");
    expect(mocks.from).toHaveBeenCalledTimes(3);
  });
  it("retains retryable records and reports failures when private-object deletion fails", async () => {
    rows = {
      graduate_verification_uploads: [{ id: "upload", storage_bucket: "private", storage_path: "synthetic/upload" }],
      graduate_verification_requests: [{ id: "request", certificate_storage_path: "synthetic/certificate" }],
      member_profile_images: [{ id: "image", storage_path: "synthetic/image" }],
    };
    mocks.remove.mockRejectedValue(new Error("synthetic storage unavailable"));
    const { purgeExpiredGraduateVerificationFiles } = await import("@/lib/graduate-verification-retention.server");
    const result = await purgeExpiredGraduateVerificationFiles(new Date("2026-10-05T12:00:00Z"));
    expect(Object.values(result)).toEqual(Array.from({ length: 3 }, () => ({ deleted: 0, failed: 1 })));
    expect(mocks.remove).toHaveBeenCalledTimes(3);
    expect(operations).toHaveLength(3);
    expect(operations.flatMap(({ calls }) => calls).filter(([operation]) => ["delete", "update"].includes(operation))).toEqual([]);
  });
  it("restricts superseding and deleting to pending photos and prevents an inserted status override", async () => {
    const records = await import("@/lib/repositories/supabase/member-profile-image-records.supabase");
    await records.supersedePendingProfileImages("member");
    await records.deletePendingProfileImage("image");
    await records.insertPendingProfileImage({ member_id: "member", status: "active" });
    expect(operations[0].calls).toContainEqual(["eq", "member_id", "member"]);
    expect(operations[0].calls).toContainEqual(["is", "graduate_verification_request_id", null]);
    expect(operations[0].calls).toContainEqual(["eq", "status", "pending"]);
    expect(operations[1].calls).toContainEqual(["eq", "id", "image"]);
    expect(operations[1].calls).toContainEqual(["eq", "status", "pending"]);
    expect(operations[2].calls).toContainEqual(["insert", { member_id: "member", status: "pending" }]);
  });
  it("maps shared member security and photo reads without broadening account scope", async () => {
    rows = { members: [{ id: "member", password_hash: "synthetic-hash", password_salt: "synthetic-salt", email_normalized: "fixture@example.test", email_verified_at: "2026-10-05", display_name: "회원" }], member_profile_images: [{ id: "photo", member_id: "member", status: "pending" }] };
    const security = await import("@/lib/repositories/supabase/member-security-repository.supabase");
    const photos = await import("@/lib/repositories/supabase/member-profile-image-records.supabase");
    expect(await security.readMemberPasswordRecord("member")).toEqual({ hash: "synthetic-hash", salt: "synthetic-salt" });
    expect(await security.readMemberEmailNoticeState("member")).toEqual({ emailNormalized: "fixture@example.test", emailVerifiedAt: "2026-10-05", displayName: "회원" });
    expect(await photos.findActiveProfileImageMember("member")).toEqual({ id: "member" });
    expect(await photos.findMemberProfileImageByStoragePath("synthetic/photo")).toEqual({ id: "photo", memberId: "member", status: "pending" });
    for (const operation of operations.slice(0, 3)) {
      expect(operation.calls).toContainEqual(["eq", "id", "member"]);
      expect(operation.calls).toContainEqual(["is", "deleted_at", null]);
    }
    expect(operations[3].calls).toContainEqual(["eq", "storage_path", "synthetic/photo"]);
    rows = {};
    expect(await security.readMemberPasswordRecord("missing")).toBeNull();
    expect(await security.readMemberEmailNoticeState("missing")).toBeNull();
    expect(await photos.findActiveProfileImageMember("missing")).toBeNull();
    expect(await photos.findMemberProfileImageByStoragePath("missing")).toBeNull();
  });
  it("returns safe errors when shared member reads fail", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(async () => ({ data: null, error: { message: "synthetic internal database detail" } })) };
    for (const method of [query.select, query.eq, query.is]) method.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    const security = await import("@/lib/repositories/supabase/member-security-repository.supabase");
    const photos = await import("@/lib/repositories/supabase/member-profile-image-records.supabase");
    await expect(security.readMemberPasswordRecord("member")).rejects.toThrow("MEMBER_PASSWORD_READ_FAILED");
    await expect(security.readMemberEmailNoticeState("member")).rejects.toThrow("MEMBER_EMAIL_NOTICE_READ_FAILED");
    await expect(photos.findActiveProfileImageMember("member")).rejects.toThrow("회원 정보를 확인하지 못했습니다.");
    await expect(photos.findMemberProfileImageByStoragePath("synthetic/photo")).rejects.toThrow("프로필 사진 상태를 확인하지 못했습니다.");
  });
});
