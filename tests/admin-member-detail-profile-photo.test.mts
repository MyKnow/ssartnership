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

test("관리자 사진 교체 API는 동일 출처와 profile_images 수정 권한을 강제한다", async () => {
  const [signRoute, submitRoute] = await Promise.all([
    read("src/app/api/admin/members/[id]/profile-photo/sign/route.ts"),
    read("src/app/api/admin/members/[id]/profile-photo/route.ts"),
  ]);

  for (const source of [signRoute, submitRoute]) {
    assert.match(source, /isTrustedSameOriginRequest/);
    assert.match(source, /ensureAdminApiPermission\(request, "profile_images", "update"\)/);
  }
  assert.match(signRoute, /createGraduateVerificationSignedUpload/);
  assert.match(submitRoute, /submitMemberProfileImageReplacement/);
  assert.match(submitRoute, /member_profile_photo_replace/);
});
