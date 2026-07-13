import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL(
  "../src/app/admin/(protected)/profile-photos/page.tsx",
  import.meta.url,
);
const actionPath = new URL(
  "../src/app/admin/(protected)/profile-photos/actions.ts",
  import.meta.url,
);
const navigationPath = new URL(
  "../src/components/admin/admin-navigation.ts",
  import.meta.url,
);
const replacementImageRoutePath = new URL(
  "../src/app/api/admin/profile-photos/images/[imageId]/route.ts",
  import.meta.url,
);
const currentImageRoutePath = new URL(
  "../src/app/api/admin/profile-photos/current/[memberId]/route.ts",
  import.meta.url,
);

test("공통 프로필 사진 검토는 수료생 인증과 별도 권한 및 경로를 사용한다", async () => {
  const [pageSource, actionSource, navigationSource] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(actionPath, "utf8"),
    readFile(navigationPath, "utf8"),
  ]);

  assert.match(pageSource, /requireAdminPermission\("profile_images", "read"/);
  assert.match(pageSource, /graduate_verification_request_id", null/);
  assert.match(actionSource, /requireAdminPermission\("profile_images", "update"/);
  assert.match(actionSource, /rejectMemberActiveProfilePhoto/);
  assert.match(navigationSource, /href: "\/admin\/profile-photos"/);
});

test("수료생 검토 큐는 사진 교체 대기열을 직접 렌더하지 않는다", async () => {
  const [pageSource, queueSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/graduate-verifications/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminGraduateVerificationQueue.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(pageSource, /member_profile_images/);
  assert.doesNotMatch(pageSource, /approveGraduateProfileImageAction/);
  assert.doesNotMatch(queueSource, /사진 변경 요청/);
});

test("관리자 사진 미리보기 API는 전용 권한과 private 응답을 강제한다", async () => {
  const [replacementRoute, currentRoute] = await Promise.all([
    readFile(replacementImageRoutePath, "utf8"),
    readFile(currentImageRoutePath, "utf8"),
  ]);

  for (const source of [replacementRoute, currentRoute]) {
    assert.match(source, /ensureAdminApiPermission\(request, "profile_images", "read"\)/);
    assert.match(source, /"cache-control": "private, no-store"/);
    assert.match(source, /"x-content-type-options": "nosniff"/);
  }
});
