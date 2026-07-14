import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("회원 상세 사진 관리는 기존 검토 액션과 private 사진 경로를 재사용한다", async () => {
  const [page, view] = await Promise.all([
    read("src/app/admin/(protected)/members/[memberId]/page.tsx"),
    read("src/components/admin/AdminMemberDetailView.tsx"),
  ]);

  assert.match(page, /profilePhoto=/);
  assert.match(page, /approveMemberProfilePhotoAction/);
  assert.match(page, /rejectMemberProfilePhotoAction/);
  assert.match(page, /rejectMemberCurrentProfilePhotoAction/);
  assert.match(page, /"profile_images",\s*"read"/);
  assert.match(view, /AdminMemberProfilePhotoPanel/);
});

test("관리자 사진 직접 변경 API는 동일 출처·수정 권한·최종 WebP 계약을 강제한다", async () => {
  const [panel, signRoute, submitRoute, service] = await Promise.all([
    read("src/components/admin/member-detail/AdminMemberProfilePhotoPanel.tsx"),
    read("src/app/api/admin/members/[id]/profile-photo/sign/route.ts"),
    read("src/app/api/admin/members/[id]/profile-photo/route.ts"),
    read("src/lib/graduate-verification-service.ts"),
  ]);

  for (const source of [signRoute, submitRoute]) {
    assert.match(source, /isTrustedSameOriginRequest/);
    assert.match(source, /ensureAdminApiPermission\(request, "profile_images", "update"\)/);
  }
  assert.match(signRoute, /createGraduateVerificationSignedUpload/);
  assert.match(signRoute, /value === "image\/webp"/);
  assert.match(signRoute, /isGraduateVerificationBlocked/);
  assert.match(signRoute, /recordGraduateVerificationAttempt/);
  assert.match(submitRoute, /replaceMemberProfileImageByAdmin/);
  assert.match(submitRoute, /session\.adminId/);
  assert.match(submitRoute, /isGraduateVerificationBlocked/);
  assert.match(submitRoute, /recordGraduateVerificationAttempt/);
  assert.doesNotMatch(submitRoute, /submitMemberProfileImageReplacement/);
  assert.match(submitRoute, /member_profile_photo_replace/);
  assert.match(panel, /ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT/);
  assert.match(panel, /prepareAdminMemberProfilePhotoSource/);
  assert.match(panel, /사진 변경/);
  assert.doesNotMatch(panel, /사진 변경 요청/);
  assert.match(service, /export async function replaceMemberProfileImageByAdmin/);
  assert.match(service, /source: "manual_admin"/);
  assert.match(service, /approveMemberProfileImageReplacement\(\{\s*imageId: data\.id,\s*adminId: input\.adminId,?\s*\}\)/);
});
