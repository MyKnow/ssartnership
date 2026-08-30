import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSettingsHref,
  getMemberAccountDeletionNavigation,
  getMemberSettingsNavigation,
  isFocusedSiteFlow,
  isMyInfoPath,
  isPartnerDetailPath,
  shouldSuppressPwaVisitRecommendation,
} from "@/lib/site-navigation";

test("설정 진입은 현재 내부 화면을 복귀 경로로 보존한다", () => {
  assert.equal(
    buildSettingsHref("/certification"),
    "/settings?returnTo=%2Fcertification",
  );
  assert.equal(buildSettingsHref("/settings"), "/settings");
});

test("설정 복귀 경로는 외부 URL과 자기 중첩을 차단한다", () => {
  assert.deepEqual(getMemberSettingsNavigation("https://evil.example/phish"), {
    backHref: "/certification",
    settingsHref: "/settings?returnTo=%2Fcertification",
  });
  assert.deepEqual(getMemberSettingsNavigation("/settings?returnTo=%2F"), {
    backHref: "/certification",
    settingsHref: "/settings?returnTo=%2Fcertification",
  });
  assert.deepEqual(getMemberSettingsNavigation("/?view=list#benefits"), {
    backHref: "/?view=list#benefits",
    settingsHref: "/settings?returnTo=%2F%3Fview%3Dlist%23benefits",
  });
});

test("회원 탈퇴 경고 화면은 설정 주소만 안전한 복귀 경로로 사용한다", () => {
  assert.deepEqual(
    getMemberAccountDeletionNavigation("/settings?returnTo=%2Fcertification"),
    {
      settingsHref: "/settings?returnTo=%2Fcertification",
      deletionHref:
        "/settings/delete-account?returnTo=%2Fsettings%3FreturnTo%3D%252Fcertification",
    },
  );
  assert.deepEqual(
    getMemberAccountDeletionNavigation("https://evil.example/phish"),
    {
      settingsHref: "/settings",
      deletionHref: "/settings/delete-account?returnTo=%2Fsettings",
    },
  );
  assert.deepEqual(
    getMemberAccountDeletionNavigation("/settings/delete-account"),
    {
      settingsHref: "/settings",
      deletionHref: "/settings/delete-account?returnTo=%2Fsettings",
    },
  );
});

test("내 정보 활성 상태와 집중 흐름을 구분한다", () => {
  assert.equal(isMyInfoPath("/settings"), true);
  assert.equal(isMyInfoPath("/certification"), true);
  assert.equal(isMyInfoPath("/coupons"), false);
  assert.equal(isFocusedSiteFlow("/certification/email"), true);
  assert.equal(isFocusedSiteFlow("/certification/photo"), true);
  assert.equal(isFocusedSiteFlow("/settings/delete-account"), true);
  assert.equal(isFocusedSiteFlow("/settings"), false);
});

test("파트너 상세는 CTA에 집중할 수 있도록 모바일 공용 탐색을 숨기는 경로로 판정한다", () => {
  assert.equal(isPartnerDetailPath("/partners/partner-id"), true);
  assert.equal(isPartnerDetailPath("/partners"), false);
  assert.equal(isPartnerDetailPath("/partners/partner-id/benefit-use"), false);
});

test("앱 설치 권장은 집중 흐름과 설치·파트너 화면에서 숨긴다", () => {
  assert.equal(shouldSuppressPwaVisitRecommendation("/"), false);
  assert.equal(shouldSuppressPwaVisitRecommendation("/campuses/seoul"), false);
  assert.equal(shouldSuppressPwaVisitRecommendation("/auth/login"), true);
  assert.equal(shouldSuppressPwaVisitRecommendation("/install"), true);
  assert.equal(
    shouldSuppressPwaVisitRecommendation("/install?platform=ios"),
    true,
  );
  assert.equal(
    shouldSuppressPwaVisitRecommendation("/partners/partner-id"),
    true,
  );
  assert.equal(
    shouldSuppressPwaVisitRecommendation(
      "/partners/partner-id/benefit-use",
    ),
    true,
  );
});
