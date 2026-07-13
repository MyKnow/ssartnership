import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getMemberProfilePhotoAccessState,
  requiresMemberProfilePhotoUpdate,
} from "@/lib/member-profile-photo";
import { resolveMemberProfilePhotoState } from "@/lib/member-profile-images";

const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const siteLayoutPath = new URL("../src/app/(site)/layout.tsx", import.meta.url);
const profileImageRoutePath = new URL(
  "../src/app/api/certification/profile-image/route.ts",
  import.meta.url,
);
const profileImagesPath = new URL(
  "../src/lib/member-profile-images.ts",
  import.meta.url,
);

test("사진 검토 중 또는 반려된 회원은 인증 서비스 대신 사진 갱신이 필요하다", () => {
  assert.equal(requiresMemberProfilePhotoUpdate("approved"), false);
  assert.equal(requiresMemberProfilePhotoUpdate("pending"), true);
  assert.equal(requiresMemberProfilePhotoUpdate("rejected"), true);
  assert.equal(requiresMemberProfilePhotoUpdate(null), false);
});

test("사진 상태는 사용자에게 필요한 다음 행동만 노출한다", () => {
  assert.deepEqual(getMemberProfilePhotoAccessState("approved"), {
    requiresUpdate: false,
    message: null,
  });
  assert.deepEqual(getMemberProfilePhotoAccessState("pending"), {
    requiresUpdate: true,
    message: "본인 사진 변경 요청을 검토하고 있습니다. 인증 서비스를 이용하려면 검토가 끝날 때까지 기다려 주세요.",
  });
  assert.deepEqual(getMemberProfilePhotoAccessState("rejected"), {
    requiresUpdate: true,
    message: "본인 사진을 다시 제출해 주세요. 승인 전에는 인증 서비스를 이용할 수 없습니다.",
  });
});

test("회원 사진 상태와 전용 관리자 권한은 스키마에 강제된다", async () => {
  const schema = await readFile(schemaPath, "utf8");

  assert.match(
    schema,
    /add column if not exists profile_photo_review_status text not null default 'approved'/i,
  );
  assert.match(
    schema,
    /profile_photo_review_status in \('approved', 'pending', 'rejected'\)/i,
  );
  assert.match(
    schema,
    /'profile_images'/i,
  );
});

test("사진 검토 대기 또는 반려 상태는 사진 재제출 경로만 예외로 두고 차단한다", async () => {
  const layout = await readFile(siteLayoutPath, "utf8");

  assert.match(layout, /session\?\.requiresProfilePhotoUpdate/);
  assert.match(layout, /!returnTo\.startsWith\("\/certification\/photo"\)/);
  assert.match(layout, /redirect\(`\/certification\/photo\?returnTo=/);
});

test("사진 ledger의 최신 검토 상태가 기존 승인 이미지보다 우선한다", () => {
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
  const [route, profileImages] = await Promise.all([
    readFile(profileImageRoutePath, "utf8"),
    readFile(profileImagesPath, "utf8"),
  ]);

  assert.match(route, /getActiveMemberProfileImage/);
  assert.match(profileImages, /resolveMemberProfilePhotoState/);
  assert.doesNotMatch(
    profileImages,
    /active_profile_image_id|profile_photo_review_status/,
  );
});
