import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getCertificationMemberView,
  resolveCertificationMemberView,
} from "../src/lib/certification-member-view.server.ts";
import { MOCK_MEMBER_ID } from "../src/lib/mock/member.ts";

const memberSource = {
  id: "member-1",
  mattermostUsername: "member.one",
  displayName: "회원 하나",
  generation: 15,
  campus: "서울",
  graduateVerifiedAt: null,
  mustChangePassword: false,
  activeProfileImageId: "profile-image-1",
  profilePhotoReviewStatus: "approved" as const,
};

test("인증 카드 회원 뷰는 클라이언트에 필요한 최소 표시 필드만 투영한다", () => {
  const view = resolveCertificationMemberView(memberSource);

  assert.deepEqual(view.member, {
    mattermostUsername: "member.one",
    displayName: "회원 하나",
    generation: 15,
    campus: "서울",
    graduateVerifiedAt: null,
    profileImageUrl: "/api/certification/profile-image",
  });
  assert.deepEqual(view.photoAccess, {
    requiresSubmission: false,
    restrictCertification: false,
    message: null,
  });
});

test("승인·활성 이미지와 비밀번호 설정이 모두 충족될 때만 사진을 표시한다", () => {
  for (const [status, requiresSubmission] of [
    ["missing", true],
    ["pending", false],
    ["rejected", true],
  ] as const) {
    const view = resolveCertificationMemberView({
      ...memberSource,
      profilePhotoReviewStatus: status,
    });

    assert.equal(view.member.profileImageUrl, null, status);
    assert.equal(view.photoAccess.restrictCertification, true, status);
    assert.equal(view.photoAccess.requiresSubmission, requiresSubmission, status);
  }

  assert.equal(
    resolveCertificationMemberView({
      ...memberSource,
      activeProfileImageId: null,
    }).member.profileImageUrl,
    null,
  );
  assert.equal(
    resolveCertificationMemberView({
      ...memberSource,
      mustChangePassword: true,
    }).member.profileImageUrl,
    null,
  );
});

test("서버 회원 뷰는 canonical 프로필을 재사용하고 없는 회원은 null을 반환한다", async () => {
  const previousDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
  const previousProfileImageUrl = process.env.MOCK_MEMBER_PROFILE_IMAGE_URL;
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
  process.env.MOCK_MEMBER_PROFILE_IMAGE_URL = "/mock/member-profile.jpg";

  try {
    assert.deepEqual(await getCertificationMemberView(MOCK_MEMBER_ID), {
      member: {
        mattermostUsername: "jung.minho15",
        displayName: "정민호",
        generation: 15,
        campus: "서울",
        graduateVerifiedAt: null,
        profileImageUrl: "/mock/member-profile.jpg",
      },
      photoAccess: {
        requiresSubmission: false,
        restrictCertification: false,
        message: null,
      },
    });
    assert.equal(await getCertificationMemberView("missing-member"), null);
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    } else {
      process.env.NEXT_PUBLIC_DATA_SOURCE = previousDataSource;
    }
    if (previousProfileImageUrl === undefined) {
      delete process.env.MOCK_MEMBER_PROFILE_IMAGE_URL;
    } else {
      process.env.MOCK_MEMBER_PROFILE_IMAGE_URL = previousProfileImageUrl;
    }
  }
});

test("인증 카드를 렌더링하는 세 페이지는 공용 서버 회원 뷰를 사용한다", () => {
  const pageSources = [
    "../src/app/(site)/certification/page.tsx",
    "../src/app/(site)/coupons/page.tsx",
    "../src/app/(site)/partners/[id]/benefit-use/page.tsx",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
  const serverView = readFileSync(
    new URL("../src/lib/certification-member-view.server.ts", import.meta.url),
    "utf8",
  );

  for (const source of pageSources) {
    assert.match(source, /getCertificationMemberView\(session\.userId\)/);
    assert.doesNotMatch(
      source,
      /getMemberCanonicalProfile|getMemberProfileImageUrl|getMemberProfilePhotoAccessState/,
    );
  }
  assert.match(serverView, /^import "server-only";/);
  assert.match(serverView, /getMemberCanonicalProfile/);
  assert.match(serverView, /getMemberProfilePhotoAccessState/);
  assert.match(serverView, /getMemberProfileImageUrl/);
});
