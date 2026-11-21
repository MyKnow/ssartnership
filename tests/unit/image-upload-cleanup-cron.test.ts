import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ expire: vi.fn(), approval: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/cron-route", () => ({ ensureCronApiAccess: () => null, getCronErrorResponse: () => Response.json({ ok: false }, { status: 500 }) }));
vi.mock("@/lib/image-upload/repository.server", () => ({ getImageUploadRepository: () => ({ expireStale: mocks.expire }) }));
vi.mock("@/lib/mm-signup-approval/repository", () => ({ expireMattermostSignupApprovalRequests: mocks.approval }));
vi.mock("@/lib/server-log", () => ({ logServerError: mocks.log }));
beforeEach(() => { vi.clearAllMocks(); mocks.expire.mockResolvedValue(2); mocks.approval.mockResolvedValue({ expiredRequests: 1, cleanupPending: 0 }); });
async function run() {
  const { GET } = await import("@/app/api/cron/cleanup-image-uploads/route");
  return GET(new NextRequest("http://localhost/api/cron/cleanup-image-uploads"));
}
test("가입 이미지 정리가 일부 실패하면 건수를 기록하고 5xx로 알린다", async () => {
  mocks.approval.mockResolvedValue({ expiredRequests: 3, cleanupPending: 1 });
  expect((await run()).status).toBe(500);
  expect(mocks.log).toHaveBeenCalledWith(expect.any(String), undefined, { failed: 1 });
  expect(mocks.expire).toHaveBeenCalledTimes(1);
});
test("일반 업로드 정리 실패를 성공으로 숨기지 않는다", async () => {
  mocks.expire.mockRejectedValue(new Error("cleanup pending"));
  expect((await run()).status).toBe(500);
});
test("모든 정리가 완료되면 건수를 반환한다", async () => {
  const response = await run();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, expired: 2 });
});
