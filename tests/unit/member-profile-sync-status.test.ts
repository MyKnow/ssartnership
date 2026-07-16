import { describe, expect, it } from "vitest";
import { resolveMemberProfileSyncStatus } from "@/lib/member-profile-sync-status";

describe("resolveMemberProfileSyncStatus", () => {
  it("사진 처리 실패만 남아도 변경 없음으로 축소하지 않는다", () => {
    expect(
      resolveMemberProfileSyncStatus({ updated: false, imageSkipped: true }),
    ).toBe("profilePhotoSkipped");
  });

  it("다른 필드가 반영됐을 때 사진 처리 실패를 함께 전달한다", () => {
    expect(
      resolveMemberProfileSyncStatus({ updated: true, imageSkipped: true }),
    ).toBe("updatedWithProfilePhotoSkipped");
  });

  it("사진 처리가 정상인 기존 상태를 유지한다", () => {
    expect(
      resolveMemberProfileSyncStatus({ updated: true, imageSkipped: false }),
    ).toBe("updated");
    expect(
      resolveMemberProfileSyncStatus({ updated: false, imageSkipped: false }),
    ).toBe("unchanged");
  });
});
