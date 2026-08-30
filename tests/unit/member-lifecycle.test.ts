import { beforeEach, describe, expect, test, vi } from "vitest";

const getSupabaseAdminClient = vi.fn();

vi.mock("../../src/lib/supabase/server", () => ({
  getSupabaseAdminClient,
}));

type StoragePlan = {
  profile_image_paths: string[];
  certificate_paths: string[];
};

function createSupabaseMock({
  plan = {
    profile_image_paths: ["profiles/member.webp"],
    certificate_paths: ["certificates/member.pdf"],
  },
  planError = null,
  profileStorageError = null,
  certificateStorageError = null,
  certificateStorageErrors,
  anonymizeResult = true,
  anonymizeError = null,
  currentAnonymizedAt = null,
}: {
  plan?: StoragePlan | null;
  planError?: { message: string } | null;
  profileStorageError?: { message: string } | null;
  certificateStorageError?: { message: string } | null;
  certificateStorageErrors?: Array<{ message: string } | null>;
  anonymizeResult?: boolean;
  anonymizeError?: { message: string } | null;
  currentAnonymizedAt?: string | null;
} = {}) {
  const calls: string[] = [];
  let certificateRemoveCount = 0;
  const rpc = vi.fn(async (name: string) => {
    calls.push(`rpc:${name}`);
    if (name === "get_deleted_member_anonymization_storage_plan") {
      return { data: plan ? [plan] : [], error: planError };
    }
    if (name === "anonymize_deleted_member") {
      return { data: anonymizeResult, error: anonymizeError };
    }
    throw new Error(`unexpected rpc: ${name}`);
  });
  const remove = vi.fn(async (bucket: string, paths: string[]) => {
    calls.push(`storage:${bucket}:${paths.join(",")}`);
    const error = bucket === "member-profile-images"
      ? profileStorageError
      : certificateStorageErrors
        ? certificateStorageErrors[certificateRemoveCount++] ?? null
        : certificateStorageError;
    return {
      data: [],
      error,
    };
  });

  return {
    calls,
    rpc,
    storage: {
      from(bucket: string) {
        return {
          remove(paths: string[]) {
            return remove(bucket, paths);
          },
        };
      },
    },
    from(table: string) {
      if (table !== "members") {
        throw new Error(`unexpected table: ${table}`);
      }
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          calls.push("query:member-state");
          return {
            data: {
              deleted_at: "2026-07-01T00:00:00.000Z",
              anonymized_at: currentAnonymizedAt,
            },
            error: null,
          };
        },
      };
      return builder;
    },
  };
}

describe("member anonymization private Storage orchestration", () => {
  beforeEach(() => {
    getSupabaseAdminClient.mockReset();
    vi.resetModules();
  });

  test("does not mutate Storage or member rows before the database retention gate", async () => {
    const supabase = createSupabaseMock({ plan: null });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).resolves.toBe(false);
    expect(supabase.calls).toEqual([
      "rpc:get_deleted_member_anonymization_storage_plan",
    ]);
  });

  test("keeps the database retryable when profile Storage deletion fails", async () => {
    const supabase = createSupabaseMock({
      profileStorageError: { message: "provider detail" },
    });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).rejects.toThrow(
      "익명화할 프로필 사진을 삭제하지 못했습니다.",
    );
    expect(supabase.calls).toEqual([
      "rpc:get_deleted_member_anonymization_storage_plan",
      "storage:member-profile-images:profiles/member.webp",
    ]);
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "anonymize_deleted_member",
      expect.anything(),
    );
  });

  test("keeps database paths when a later certificate deletion fails", async () => {
    const supabase = createSupabaseMock({
      certificateStorageError: { message: "provider detail" },
    });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).rejects.toThrow(
      "익명화할 교육이수증을 삭제하지 못했습니다.",
    );
    expect(supabase.calls).toEqual([
      "rpc:get_deleted_member_anonymization_storage_plan",
      "storage:member-profile-images:profiles/member.webp",
      "storage:graduate-certificates:certificates/member.pdf",
    ]);
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "anonymize_deleted_member",
      expect.anything(),
    );
  });

  test("purges relational data only after every private object deletion succeeds", async () => {
    const supabase = createSupabaseMock({
      plan: {
        profile_image_paths: ["profiles/member.webp"],
        certificate_paths: [
          "certificates/member.pdf",
          "certificates/member-old.pdf",
        ],
      },
    });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).resolves.toBe(true);
    expect(supabase.calls).toEqual([
      "rpc:get_deleted_member_anonymization_storage_plan",
      "storage:member-profile-images:profiles/member.webp",
      "storage:graduate-certificates:certificates/member.pdf,certificates/member-old.pdf",
      "rpc:anonymize_deleted_member",
    ]);
  });

  test("retries an already removed path before purging relational data", async () => {
    const supabase = createSupabaseMock({
      certificateStorageErrors: [{ message: "transient provider detail" }, null],
    });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).rejects.toThrow(
      "익명화할 교육이수증을 삭제하지 못했습니다.",
    );
    await expect(anonymizeDeletedMember("member-id")).resolves.toBe(true);
    expect(supabase.calls).toEqual([
      "rpc:get_deleted_member_anonymization_storage_plan",
      "storage:member-profile-images:profiles/member.webp",
      "storage:graduate-certificates:certificates/member.pdf",
      "rpc:get_deleted_member_anonymization_storage_plan",
      "storage:member-profile-images:profiles/member.webp",
      "storage:graduate-certificates:certificates/member.pdf",
      "rpc:anonymize_deleted_member",
    ]);
  });

  test("treats a concurrent completed anonymization as an idempotent no-op", async () => {
    const supabase = createSupabaseMock({
      anonymizeResult: false,
      currentAnonymizedAt: "2026-08-13T00:00:00.000Z",
    });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).resolves.toBe(false);
    expect(supabase.calls.at(-1)).toBe("query:member-state");
  });

  test("does not hide a changed recovery gate after private files were removed", async () => {
    const supabase = createSupabaseMock({ anonymizeResult: false });
    getSupabaseAdminClient.mockReturnValue(supabase);
    const { anonymizeDeletedMember } = await import("../../src/lib/member-lifecycle");

    await expect(anonymizeDeletedMember("member-id")).rejects.toThrow(
      "회원 익명화 상태가 변경되었습니다.",
    );
    expect(supabase.calls.at(-1)).toBe("query:member-state");
  });
});
