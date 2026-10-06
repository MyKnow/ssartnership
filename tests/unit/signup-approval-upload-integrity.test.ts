import { beforeEach, expect, test, vi } from "vitest";
import type { CreateMattermostSignupApprovalRequestInput } from "@/lib/mm-signup-approval/repository";

const mocks = vi.hoisted(() => ({ read: vi.fn(), insert: vi.fn(), discard: vi.fn(), retain: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({
  from: () => {
    const query = {
      select: () => query, eq: () => query, insert: () => query,
      maybeSingle: mocks.read, single: mocks.insert,
    };
    return query;
  },
}) }));
vi.mock("@/lib/image-upload/repository.server", () => ({ getImageUploadRepository: () => ({ discard: mocks.discard, retainForApproval: mocks.retain }) }));
vi.mock("@/lib/member-signup-profile", () => ({ attachMattermostSignupApprovalProfileImage: vi.fn() }));
const input = {
  mmUserId: "mm-1", mattermostAccountId: "account-1", mmUsername: "member", mattermostDisplayName: "회원",
  senderGeneration: 15, requestedGeneration: 15, parseExclusionReason: null,
  passwordHash: "test-hash", passwordSalt: "test-salt", servicePolicy: { id: "service", version: 1 },
  privacyPolicy: { id: "privacy", version: 1 }, marketingPolicy: null, marketingPolicyChecked: false,
  ipAddress: null, userAgent: null, profileImageUploadId: "upload-a", signupUploadOwnerId: "owner-1",
} as CreateMattermostSignupApprovalRequestInput;
const pending = { id: "request-1", status: "pending", mm_user_id: "mm-1", expires_at: "2099-01-01T00:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockReset(); mocks.insert.mockReset(); mocks.discard.mockResolvedValue(undefined); mocks.retain.mockResolvedValue(undefined); });

for (const id of ["upload-a", "upload-b"]) {
  test(`동시 승인 신청의 중복 insert 뒤 ${id}를 임의 폐기하지 않는다`, async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: pending, error: null });
    mocks.insert.mockResolvedValue({ data: null, error: { code: "23505" } });
    const { createMattermostSignupApprovalRequest } = await import("@/lib/mm-signup-approval/repository");
    expect((await createMattermostSignupApprovalRequest({ ...input, profileImageUploadId: id })).status).toBe("pending");
    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.retain).toHaveBeenCalledWith(expect.objectContaining({ uploadId: id }));
  });
}
test("승인 insert의 응답이 유실되면 서버 commit 여부와 무관하게 업로드를 보존한다", async () => {
  mocks.read.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockRejectedValue(new Error("request timeout after commit"));
  const { createMattermostSignupApprovalRequest } = await import("@/lib/mm-signup-approval/repository");
  await expect(createMattermostSignupApprovalRequest(input)).rejects.toThrow();
  expect(mocks.discard).not.toHaveBeenCalled();
});
