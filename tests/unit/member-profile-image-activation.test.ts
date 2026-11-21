import { beforeEach, expect, test, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({ rpc, from }) }));

import { activateMemberProfileImage } from "@/lib/member-profile-images";

beforeEach(() => vi.clearAllMocks());

test("사진 활성화는 단일 RPC의 확인된 성공만 반환한다", async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  await expect(activateMemberProfileImage({ memberId: "member", nextImageId: "image" })).resolves.toBe(true);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("activate_member_profile_image_atomic", {
    input_member_id: "member", input_image_id: "image",
  });
  expect(from).not.toHaveBeenCalled();
});

test.each([
  { data: false, error: null }, { data: null, error: null },
  { data: null, error: { message: "private failure" } },
])("실패와 불확실한 결과는 순차 쓰기로 우회하지 않는다: %j", async (result) => {
  rpc.mockResolvedValue(result);
  await expect(activateMemberProfileImage({ memberId: "member", nextImageId: "image" }))
    .rejects.toThrow("현재 프로필 사진을 반영하지 못했습니다.");
  expect(from).not.toHaveBeenCalled();
});
