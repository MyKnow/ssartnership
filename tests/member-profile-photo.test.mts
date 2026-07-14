import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getMemberProfilePhotoAccessState,
  requiresMemberProfilePhotoUpdate,
} from "@/lib/member-profile-photo";
import { resolveMemberProfilePhotoState } from "@/lib/member-profile-images";
import {
  buildForwardedRequestPath,
  getForwardedRequestPath,
  REQUEST_PATH_HEADER,
} from "@/lib/request-path";

const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const siteLayoutPath = new URL("../src/app/(site)/layout.tsx", import.meta.url);
const adminProtectedLayoutPath = new URL(
  "../src/app/admin/(protected)/layout.tsx",
  import.meta.url,
);
const proxyPath = new URL("../src/proxy.ts", import.meta.url);
const profileImageRoutePath = new URL(
  "../src/app/api/certification/profile-image/route.ts",
  import.meta.url,
);
const profileImagesPath = new URL(
  "../src/lib/member-profile-images.ts",
  import.meta.url,
);
const profileSyncPath = new URL(
  "../src/lib/member-mattermost-profile-sync.ts",
  import.meta.url,
);

test("사진이 없는 회원만 사진 제출 전까지 일반 이용을 막고, 검토 상태는 인증 기능만 제한한다", () => {
  assert.equal(requiresMemberProfilePhotoUpdate("missing"), true);
  assert.equal(requiresMemberProfilePhotoUpdate("approved"), false);
  assert.equal(requiresMemberProfilePhotoUpdate("pending"), false);
  assert.equal(requiresMemberProfilePhotoUpdate("rejected"), false);
  assert.equal(requiresMemberProfilePhotoUpdate(null), false);
});

test("사진 상태는 사용자에게 필요한 다음 행동만 노출한다", () => {
  assert.deepEqual(getMemberProfilePhotoAccessState("approved"), {
    requiresSubmission: false,
    restrictCertification: false,
    message: null,
  });
  assert.deepEqual(getMemberProfilePhotoAccessState("missing"), {
    requiresSubmission: true,
    restrictCertification: true,
    message: "본인 사진을 제출한 뒤 서비스를 이용할 수 있습니다.",
  });
  assert.deepEqual(getMemberProfilePhotoAccessState("pending"), {
    requiresSubmission: false,
    restrictCertification: true,
    message: "본인 사진 변경 요청을 검토하고 있습니다. 인증 서비스를 이용하려면 검토가 끝날 때까지 기다려 주세요.",
  });
  assert.deepEqual(getMemberProfilePhotoAccessState("rejected"), {
    requiresSubmission: false,
    restrictCertification: true,
    message: "본인 사진을 다시 제출해 주세요. 승인 전에는 인증 서비스를 이용할 수 없습니다.",
  });
});

test("회원 사진 상태는 canonical ledger와 단일 승인 이미지 제약으로 강제된다", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.match(
    schema,
    /member_profile_images_one_approved_per_member_idx/i,
  );
  assert.match(
    schema,
    /drop column if exists profile_photo_review_status/i,
  );
  assert.match(
    schema,
    /old\.status = 'approved' and new\.status in \('superseded', 'rejected'\)/i,
  );
  assert.match(
    schema,
    /'profile_images'/i,
  );
});

test("사진 제출 경로는 공통 게이트 해석기로 자기 재진입을 막는다", async () => {
  const layout = await readFile(siteLayoutPath, "utf8");

  assert.match(layout, /session\?\.requiresProfilePhotoUpdate/);
  assert.match(layout, /getMemberRequiredGateRedirect/);
  assert.match(layout, /currentPath: returnTo/);
});

test("사진 제출 경로는 Next 내부 헤더와 분리된 요청 경로 컨텍스트를 사용한다", async () => {
  const [layout, adminLayout, proxy] = await Promise.all([
    readFile(siteLayoutPath, "utf8"),
    readFile(adminProtectedLayoutPath, "utf8"),
    readFile(proxyPath, "utf8"),
  ]);
  const photoPath = "/certification/photo?returnTo=%2F";
  const requestHeaders = new Headers([
    ["next-url", "/"],
    [REQUEST_PATH_HEADER, photoPath],
  ]);

  assert.equal(
    buildForwardedRequestPath({
      pathname: "/certification/photo",
      search: "?returnTo=%2F",
    }),
    photoPath,
  );
  assert.equal(getForwardedRequestPath(requestHeaders), photoPath);
  assert.match(proxy, /requestHeaders\.set\(\s*REQUEST_PATH_HEADER/);
  assert.doesNotMatch(proxy, /"next-url"/);
  assert.match(layout, /getForwardedRequestPath\(headerStore\)/);
  assert.match(adminLayout, /getForwardedRequestPath\(headerStore\)/);
});

test("사진 ledger의 최신 검토 상태가 기존 승인 이미지보다 우선한다", () => {
  assert.deepEqual(resolveMemberProfilePhotoState([]), {
    reviewStatus: "missing",
    activeProfileImageId: null,
    activeStoragePath: null,
    updatedAt: null,
  });

  assert.deepEqual(
    resolveMemberProfilePhotoState([
      {
        id: "approved-image",
        status: "approved",
        storagePath: "members/member-1/approved.webp",
        updatedAt: "2026-07-10T00:00:00.000Z",
        createdAt: "2026-07-10T00:00:00.000Z",
      },
      {
        id: "pending-image",
        status: "pending",
        storagePath: "members/member-1/pending.webp",
        updatedAt: "2026-07-11T00:00:00.000Z",
        createdAt: "2026-07-11T00:00:00.000Z",
      },
    ]),
    {
      reviewStatus: "pending",
      activeProfileImageId: null,
      activeStoragePath: null,
      updatedAt: "2026-07-11T00:00:00.000Z",
    },
  );

  assert.deepEqual(
    resolveMemberProfilePhotoState([
      {
        id: "rejected-image",
        status: "rejected",
        storagePath: "members/member-1/rejected.webp",
        updatedAt: "2026-07-12T00:00:00.000Z",
        createdAt: "2026-07-12T00:00:00.000Z",
      },
      {
        id: "new-approved-image",
        status: "approved",
        storagePath: "members/member-1/new.webp",
        updatedAt: "2026-07-13T00:00:00.000Z",
        createdAt: "2026-07-13T00:00:00.000Z",
      },
    ]),
    {
      reviewStatus: "approved",
      activeProfileImageId: "new-approved-image",
      activeStoragePath: "members/member-1/new.webp",
      updatedAt: "2026-07-13T00:00:00.000Z",
    },
  );
});

test("인증 카드의 private 사진 API는 canonical 이미지 ledger만 읽는다", async () => {
  const [route, profileImages, profileSync] = await Promise.all([
    readFile(profileImageRoutePath, "utf8"),
    readFile(profileImagesPath, "utf8"),
    readFile(profileSyncPath, "utf8"),
  ]);

  assert.match(route, /getActiveMemberProfileImage/);
  assert.match(profileImages, /resolveMemberProfilePhotoState/);
  assert.doesNotMatch(
    profileImages,
    /active_profile_image_id|profile_photo_review_status/,
  );
  assert.match(profileImages, /status: "pending"/);
  assert.match(profileSync, /syncMemberProfileImage/);
  assert.match(profileImages, /discardMemberProfileImage/);
});
