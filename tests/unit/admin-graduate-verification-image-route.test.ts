import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  downloadPrivateMemberProfileImageMock,
  ensureAdminApiPermissionMock,
  getAdminSessionMock,
  getSupabaseAdminClientMock,
  logAdminAuditMock,
  queryResults,
  queryCalls,
  withServerTimingMock,
} = vi.hoisted(() => ({
  downloadPrivateMemberProfileImageMock: vi.fn(),
  ensureAdminApiPermissionMock: vi.fn(),
  getAdminSessionMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  logAdminAuditMock: vi.fn(),
  queryResults: new Map<string, { data: unknown; error: unknown }>(),
  queryCalls: [] as Array<{
    table: string;
    method: string;
    args: unknown[];
  }>,
  withServerTimingMock: vi.fn(),
}));

function createQuery(table: string) {
  const query = {
    select: (...args: unknown[]) => {
      queryCalls.push({ table, method: "select", args });
      return query;
    },
    eq: (...args: unknown[]) => {
      queryCalls.push({ table, method: "eq", args });
      return query;
    },
    in: (...args: unknown[]) => {
      queryCalls.push({ table, method: "in", args });
      return query;
    },
    is: (...args: unknown[]) => {
      queryCalls.push({ table, method: "is", args });
      return query;
    },
    maybeSingle: async () =>
      queryResults.get(table) ?? { data: null, error: null },
  };
  return query;
}

vi.mock("@/lib/admin-access", () => ({
  ensureAdminApiPermission: ensureAdminApiPermissionMock,
}));
vi.mock("@/lib/auth", () => ({
  getAdminSession: getAdminSessionMock,
}));
vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: () => ({}),
  logAdminAudit: logAdminAuditMock,
}));
vi.mock("@/lib/graduate-verification-storage", () => ({
  downloadPrivateMemberProfileImage: downloadPrivateMemberProfileImageMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));
vi.mock("@/lib/server-timing", () => ({
  withServerTiming: withServerTimingMock,
}));

import { GET } from "../../src/app/api/admin/graduate-verifications/images/[imageId]/route";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

function getRequest() {
  return new NextRequest(
    `https://example.com/api/admin/graduate-verifications/images/${IMAGE_ID}`,
  );
}

describe("graduate verification image route", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.splice(0, queryCalls.length);
    ensureAdminApiPermissionMock.mockReset().mockResolvedValue(null);
    getAdminSessionMock.mockReset().mockResolvedValue({ adminId: "admin-id" });
    downloadPrivateMemberProfileImageMock.mockReset();
    logAdminAuditMock.mockReset();
    getSupabaseAdminClientMock.mockReset().mockReturnValue({
      from: (table: string) => createQuery(table),
    });
    withServerTimingMock.mockReset().mockImplementation(
      async (
        handler: (timing: {
          measure: <T>(label: string, operation: () => Promise<T> | T) => Promise<T>;
        }) => Promise<Response>,
      ) =>
        handler({
          measure: async <T>(_label: string, operation: () => Promise<T> | T) =>
            operation(),
        }),
    );
  });

  it("rejects an image outside the active review queue before storage lookup", async () => {
    queryResults.set("graduate_verification_requests", {
      data: null,
      error: null,
    });

    const response = await GET(getRequest(), {
      params: Promise.resolve({ imageId: IMAGE_ID }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      message: "본인 사진을 찾을 수 없습니다.",
    });
    expect(
      queryCalls.some((call) => call.table === "member_profile_images"),
    ).toBe(false);
    expect(downloadPrivateMemberProfileImageMock).not.toHaveBeenCalled();
  });

  it("returns only the selected pending image owned by a current queue request", async () => {
    queryResults.set("graduate_verification_requests", {
      data: { id: REQUEST_ID },
      error: null,
    });
    queryResults.set("member_profile_images", {
      data: { storage_path: "graduate-verification/profile.webp" },
      error: null,
    });
    downloadPrivateMemberProfileImageMock.mockResolvedValue(
      new Uint8Array([1, 2, 3]).buffer,
    );

    const response = await GET(getRequest(), {
      params: Promise.resolve({ imageId: IMAGE_ID }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(queryCalls).toContainEqual({
      table: "graduate_verification_requests",
      method: "eq",
      args: ["profile_image_id", IMAGE_ID],
    });
    expect(queryCalls).toContainEqual({
      table: "graduate_verification_requests",
      method: "in",
      args: ["status", ["submitted", "in_review"]],
    });
    expect(queryCalls).toContainEqual({
      table: "member_profile_images",
      method: "eq",
      args: ["graduate_verification_request_id", REQUEST_ID],
    });
    expect(queryCalls).toContainEqual({
      table: "member_profile_images",
      method: "eq",
      args: ["status", "pending"],
    });
    expect(queryCalls).toContainEqual({
      table: "member_profile_images",
      method: "is",
      args: ["deleted_at", null],
    });
    expect(downloadPrivateMemberProfileImageMock).toHaveBeenCalledWith(
      "graduate-verification/profile.webp",
    );
  });
});
