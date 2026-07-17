import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("로그인과 비밀번호 재설정은 정규화된 회원·MM 디렉터리 관계만 사용한다", () => {
  const memberAuthentication = readRepoFile("src/lib/member-authentication.ts");
  const resetIdentity = readRepoFile(
    "src/app/api/mm/_shared/reset-password-identity.ts",
  );
  const mattermostCodeVerifyRoute = readRepoFile(
    "src/app/api/mm/code/verify/route.ts",
  );
  const resetComplete = readRepoFile(
    "src/app/api/mm/_shared/reset-password-complete.ts",
  );

  assert.match(memberAuthentication, /mattermost_account_id/);
  assert.doesNotMatch(
    memberAuthentication,
    /findActiveMemberByLegacyMattermostUserId|member_auth_identities|\.eq\("mm_user_id"/,
  );

  assert.match(resetIdentity, /\.eq\("mattermost_account_id", directoryEntry\.id\)/);
  assert.doesNotMatch(resetIdentity, /@\/lib\/mm-member-sync|\.eq\("mm_user_id"/);

  assert.match(mattermostCodeVerifyRoute, /\.from\("mm_user_directory"\)/);
  assert.match(
    mattermostCodeVerifyRoute,
    /issueResetPasswordCompletionToken/,
  );
  assert.doesNotMatch(
    mattermostCodeVerifyRoute,
    /\.from\("members"\)[\s\S]{0,500}\.eq\("mm_user_id"/,
  );

  assert.match(
    resetComplete,
    /\.from\("mm_user_directory"\)[\s\S]{0,400}\.eq\("mm_user_id", tokenPayload\.mmUserId\)/,
  );
  assert.match(
    resetComplete,
    /\.eq\("mattermost_account_id", directoryEntry\.id\)/,
  );
  assert.doesNotMatch(
    resetComplete,
    /\.from\("members"\)[\s\S]{0,500}\.eq\("mm_user_id"/,
  );
});

test("관리자 권한은 admin_profiles와 MM 디렉터리만 기준으로 관리한다", () => {
  const adminAccounts = readRepoFile("src/lib/admin-accounts.ts");

  assert.match(adminAccounts, /\.from\("admin_profiles"\)/);
  assert.match(adminAccounts, /\.from\("mm_user_directory"\)/);
  assert.match(
    adminAccounts,
    /\.eq\("mattermost_account_id", directory\.id\)/,
  );
  assert.doesNotMatch(
    adminAccounts,
    /mapLegacyAdminMember|admin_permission_id|admin_managed_campus_slugs|Dual-write/,
  );
  assert.doesNotMatch(
    adminAccounts,
    /\.from\("members"\)[\s\S]{0,500}\.eq\("mm_username"/,
  );
});

test("운영 bootstrap과 Preview seed도 정규화된 관리자 관계를 사용한다", () => {
  const bootstrap = readRepoFile("scripts/bootstrap-super-admin.mjs");
  const previewSync = readRepoFile("scripts/supabase-sync-preview.mjs");

  assert.match(bootstrap, /\.from\("mm_user_directory"\)/);
  assert.match(bootstrap, /\.eq\("mattermost_account_id", directory\.id\)/);
  assert.match(bootstrap, /\.from\("admin_profiles"\)/);
  assert.doesNotMatch(bootstrap, /admin_permission_id/);

  assert.match(previewSync, /insert into public\.admin_profiles/);
  assert.match(previewSync, /join public\.mm_user_directory directory/);
  assert.doesNotMatch(
    previewSync,
    /update public\.members\s+set admin_permission_id/,
  );
});

test("정책 동의는 회원 mirror 대신 consent ledger를 기준으로 판정한다", () => {
  const policyDocuments = readRepoFile("src/lib/policy-documents.ts");
  const userAuth = readRepoFile("src/lib/user-auth.ts");
  const notificationPreferences = readRepoFile(
    "src/lib/notification-preferences.ts",
  );

  assert.match(policyDocuments, /\.from\("member_policy_consents"\)/);
  assert.match(policyDocuments, /getMemberPolicyConsentVersions/);
  assert.doesNotMatch(
    policyDocuments,
    /service_policy_version|privacy_policy_version|marketing_policy_version/,
  );
  assert.doesNotMatch(
    userAuth,
    /service_policy_version|privacy_policy_version/,
  );
  assert.match(notificationPreferences, /getMemberPolicyConsentVersions/);
  assert.doesNotMatch(
    notificationPreferences,
    /\.from\("members"\)[\s\S]{0,400}marketing_policy_version/,
  );
});

test("마케팅 수신 상태는 contract 전에 push preference로 보존한다", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260713181223_backfill_member_marketing_preferences.sql",
  );

  assert.match(migration, /insert into public\.push_preferences/);
  assert.match(migration, /from public\.member_policy_consents as consent/);
  assert.match(
    migration,
    /consent\.policy_document_id = active_marketing_policy\.id/,
  );
  assert.doesNotMatch(migration, /member\.marketing_policy_version/);
  assert.match(migration, /on conflict \(member_id\) do nothing/);
});

test("명시적 Mattermost 프로필 동기화는 디렉터리 FK와 이미지 ledger만 갱신한다", () => {
  const profileSync = readRepoFile(
    "src/lib/member-mattermost-profile-sync.ts",
  );
  const profileImages = readRepoFile("src/lib/member-profile-images.ts");

  assert.match(profileSync, /mattermost_account_id/);
  assert.match(profileSync, /syncMemberProfileImage/);
  assert.match(profileSync, /avatarBase64: snapshot\.avatarBase64/);
  assert.match(profileSync, /avatarContentType: snapshot\.avatarContentType/);
  assert.match(profileImages, /\.from\("member_profile_images"\)/);
  assert.match(profileImages, /fetchPublicImage/);
  assert.match(profileImages, /MAX_MEMBER_PROFILE_IMAGE_SOURCE_BYTES/);
  assert.doesNotMatch(
    profileSync,
    /member\.year|member\.mm_user_id|member\.mm_username|Compatibility fields/,
  );
});

test("일괄 MM 동기화와 관리자 아바타 조회는 정규화된 디렉터리·이미지 ledger만 사용한다", () => {
  const batchSync = readRepoFile("src/lib/mm-member-sync/sync.ts");
  const adminAvatar = readRepoFile("src/app/api/admin/members/[id]/avatar/route.ts");

  assert.match(batchSync, /syncMemberMattermostProfile/);
  assert.doesNotMatch(
    batchSync,
    /avatar_base64|avatar_content_type|avatar_url|member\.year|member\.mm_user_id|member\.mm_username/,
  );

  assert.match(adminAvatar, /getActiveMemberProfileImage/);
  assert.match(adminAvatar, /downloadPrivateMemberProfileImage/);
  assert.doesNotMatch(
    adminAvatar,
    /avatar_base64|avatar_content_type|avatar_url|getMemberSyncCandidateYears|resolveMemberSnapshotForYears/,
  );
});

test("인증 카드와 아바타 API는 private 이미지 ledger만 제공한다", () => {
  const certificationPage = readRepoFile("src/app/(site)/certification/page.tsx");
  const verificationPage = readRepoFile("src/app/(site)/verify/[token]/page.tsx");
  const certificationAvatar = readRepoFile(
    "src/app/api/certification/avatar/[token]/route.ts",
  );
  const memberAvatar = readRepoFile("src/app/api/mm/avatar/route.ts");
  const currentPhoto = readRepoFile(
    "src/app/api/admin/profile-photos/current/[memberId]/route.ts",
  );

  for (const source of [
    certificationPage,
    verificationPage,
    certificationAvatar,
    memberAvatar,
    currentPhoto,
  ]) {
    assert.doesNotMatch(
      source,
      /avatar_base64|avatar_content_type|avatar_url|createMemberAvatarResponse/,
    );
  }

  assert.match(certificationPage, /getMemberCanonicalProfile/);
  assert.match(verificationPage, /getMemberCanonicalProfile/);
  for (const source of [certificationAvatar, memberAvatar, currentPhoto]) {
    assert.match(source, /getActiveMemberProfileImage/);
    assert.match(source, /downloadPrivateMemberProfileImage/);
  }
});

test("홈·쿠폰·제휴 접근 권한은 정규화 회원 프로필만 사용한다", () => {
  const partnerViewContext = readRepoFile("src/lib/partner-view-context.ts");
  const couponsPage = readRepoFile("src/app/(site)/coupons/page.tsx");
  const homePage = readRepoFile("src/app/(site)/page.tsx");
  const partnerDetailPage = readRepoFile(
    "src/app/(site)/partners/[id]/page.tsx",
  );
  const homeStateRoute = readRepoFile(
    "src/app/api/partners/home-state/route.ts",
  );

  assert.match(partnerViewContext, /getMemberCanonicalProfile/);
  assert.match(couponsPage, /getMemberCanonicalProfile/);
  assert.match(homePage, /getMemberCanonicalProfile/);
  for (const source of [partnerDetailPage, homeStateRoute]) {
    assert.match(source, /getPartnerViewerContext/);
  }

  for (const source of [
    partnerViewContext,
    couponsPage,
    homePage,
    partnerDetailPage,
    homeStateRoute,
  ]) {
    assert.doesNotMatch(
      source,
      /\.select\("year,graduate_verified_at"|member\?\.year|member\?\.graduate_verified_at/,
    );
  }
});

test("수료생 계정과 탈퇴 식별자 예약은 정규화 인증 관계만 사용한다", () => {
  const memberLifecycle = readRepoFile("src/lib/member-lifecycle.ts");
  const graduateVerificationService = readRepoFile(
    "src/lib/graduate-verification-service.ts",
  );

  assert.match(memberLifecycle, /mattermost_account_id/);
  assert.match(memberLifecycle, /from\("mm_user_directory"\)/);
  assert.doesNotMatch(
    memberLifecycle,
    /member_ssafy_verifications|identity\.mm_user_id|identity\.mm_username|identity\.ssafy_sub/,
  );

  assert.match(graduateVerificationService, /.from\("graduate_profiles"\)/);
  assert.doesNotMatch(
    graduateVerificationService,
    /member_auth_identities|graduate_verified_at/,
  );
});

test("푸시 대상과 발송 화면은 세대·MM 디렉터리 관계만 사용한다", () => {
  const audience = readRepoFile("src/lib/push/audience.ts");
  const send = readRepoFile("src/lib/push/send.ts");
  const adminPushPage = readRepoFile("src/app/admin/(protected)/push/page.tsx");

  for (const source of [audience, send, adminPushPage]) {
    assert.doesNotMatch(source, /\.eq\("year"|\.select\("id,display_name,mm_username,year,campus"/);
  }
  assert.match(audience, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(adminPushPage, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(audience, /\.eq\("generation", audience\.year\)/);
  assert.match(send, /\.eq\("generation", resolvedAudience\.year\)/);
});

test("관리자 캠페인 발송은 policy ledger와 MM 디렉터리만 사용한다", () => {
  const operations = readRepoFile("src/lib/admin-notification-ops.ts");
  const delivery = readRepoFile("src/lib/admin-notification-ops-delivery.ts");

  assert.match(operations, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(operations, /\.from\("member_policy_consents"\)/);
  assert.match(operations, /\.eq\("policy_document_id", activeMarketingPolicy\.id\)/);
  assert.match(operations, /\.eq\("generation", resolvedAudience\.year\)/);
  assert.doesNotMatch(
    operations,
    /mm_user_id,mm_username|marketing_policy_version|marketing_policy_consented_at|\.eq\("year"/,
  );
  assert.doesNotMatch(delivery, /mm_user_id|source_years|\byear: number/);
  assert.match(delivery, /mattermostUserId/);
});

test("운영 알림 수신자는 활성 admin profile로만 결정한다", () => {
  const operationalNotifications = readRepoFile(
    "src/lib/operational-notifications.ts",
  );

  assert.match(operationalNotifications, /\.from\("admin_profiles"\)/);
  assert.match(operationalNotifications, /\.eq\("is_active", true\)/);
  assert.match(
    operationalNotifications,
    /\.from\("admin_notification_preferences"\)/,
  );
  assert.doesNotMatch(
    operationalNotifications,
    /admin_permission_id|SUPER_ADMIN_USERNAME|\.from\("members"\)[\s\S]{0,500}admin_notification_preferences/,
  );
});

test("이벤트 보상 후보는 세대·MM 디렉터리·정책 consent ledger로 구성한다", () => {
  const eventRewards = readRepoFile("src/lib/promotions/event-rewards.ts");

  assert.match(eventRewards, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(eventRewards, /\.from\("member_policy_consents"\)/);
  assert.match(eventRewards, /\.eq\("policy_document_id", policyDocumentId\)/);
  assert.match(
    eventRewards,
    /\.select\("id,display_name,mattermost_account_id,generation,campus,created_at"\)/,
  );
  assert.match(eventRewards, /\.order\("generation", \{ ascending: false \}\)/);
  assert.doesNotMatch(
    eventRewards,
    /\.select\("id,display_name,mm_username,year,campus,marketing_policy_version,created_at"\)|member\.marketing_policy_version|\.order\("year", \{ ascending: false \}\)/,
  );
});

test("관리자 회원 화면과 수정 액션은 정규화된 회원 관계만 사용한다", () => {
  const membersPage = readRepoFile("src/app/admin/(protected)/members/page.tsx");
  const memberDetailPage = readRepoFile(
    "src/app/admin/(protected)/members/[memberId]/page.tsx",
  );
  const memberActions = readRepoFile(
    "src/app/admin/(protected)/_actions/member-actions.ts");

  assert.match(membersPage, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(membersPage, /\.from\("member_policy_consents"\)/);
  assert.match(membersPage, /getEffectiveMarketingConsentMemberIds/);
  assert.match(membersPage, /marketing_enabled/);
  assert.match(
    membersPage,
    /mattermost_account_id,manual_login_id,display_name,generation,staff_source_generation/,
  );
  assert.match(membersPage, /\.eq\("generation", Number\(filters\.yearFilter\)\)/);
  assert.match(memberDetailPage, /getMemberCanonicalProfile/);
  assert.match(memberActions, /generation,/);
  assert.match(memberActions, /mattermost_account_id/);

  for (const source of [membersPage, memberDetailPage, memberActions]) {
    assert.doesNotMatch(
      source,
      /avatar_base64|avatar_content_type|avatar_url|service_policy_version|service_policy_consented_at|privacy_policy_version|privacy_policy_consented_at|marketing_policy_version|marketing_policy_consented_at|staff_source_year|\.eq\("year"|\byear,/,
    );
  }
});

test("리뷰 작성자 표시는 정규화된 회원·MM 디렉터리 관계를 사용한다", () => {
  const adminReviews = readRepoFile("src/lib/admin-reviews.ts");
  const partnerNotifications = readRepoFile("src/lib/partner-notifications.ts");
  const reviewRepository = readRepoFile(
    "src/lib/repositories/supabase/partner-review-repository.supabase.ts",
  );

  for (const source of [adminReviews, partnerNotifications, reviewRepository]) {
    assert.match(source, /generation/);
    assert.doesNotMatch(source, /mm_username,year|display_name,year|member\?\.year/);
  }
  assert.match(adminReviews, /mattermost_account_id/);
  assert.match(
    adminReviews,
    /mm_user_directory!members_mattermost_account_id_fkey/,
  );
});

test("관리자 로그 작성자 조회는 회원·MM 디렉터리 관계를 조합한다", () => {
  const logInsights = readRepoFile("src/lib/log-insights/data.ts");

  assert.match(logInsights, /mattermost_account_id/);
  assert.match(
    logInsights,
    /mm_user_directory!members_mattermost_account_id_fkey/,
  );
  assert.doesNotMatch(
    logInsights,
    /select\('id,display_name,mm_username'\)/,
  );
});

test("회원 mock도 canonical 뷰 모델을 사용한다", () => {
  const memberPreview = readRepoFile("src/lib/mock/member-preview.ts");
  const mockReviewRepository = readRepoFile(
    "src/lib/repositories/mock/partner-review-repository.mock.ts",
  );

  assert.match(memberPreview, /mattermostUsername/);
  assert.match(memberPreview, /generation/);
  assert.doesNotMatch(
    memberPreview,
    /mm_user_id|mm_username|avatar_base64|avatar_content_type|avatar_url|staff_source_year|service_policy_version|privacy_policy_version|marketing_policy_version|\byear:/,
  );
  assert.match(mockReviewRepository, /member\?\.displayName/);
  assert.match(mockReviewRepository, /member\?\.generation/);
  assert.doesNotMatch(mockReviewRepository, /member\?\.display_name|member\?\.year/);
});

test("수동 회원 추가와 롤백은 디렉터리 FK·세대 필드만 저장한다", () => {
  const lookup = readRepoFile("src/lib/member-manual-add/lookup.ts");
  const provision = readRepoFile("src/lib/member-manual-add/provision.ts");
  const rollback = readRepoFile("src/lib/member-manual-add/rollback.ts");

  assert.match(lookup, /findMmUserDirectoryEntryByUserId/);
  assert.match(lookup, /\.eq\("mattermost_account_id", directory\.id\)/);
  assert.doesNotMatch(lookup, /\.from\("members"\)[\s\S]{0,400}\.eq\("mm_user_id"/);

  assert.match(provision, /mattermost_account_id/);
  assert.match(provision, /staff_source_generation/);
  assert.match(provision, /resolveManualMemberResolution/);
  assert.match(provision, /withActiveMattermostSenderForGeneration/);
  assert.doesNotMatch(provision, /avatar_base64|avatar_content_type|avatar_url/);

  assert.match(rollback, /mattermost_account_id/);
  assert.doesNotMatch(
    rollback,
    /mm_user_id|mm_username|avatar_base64|avatar_content_type|avatar_url|\byear:/,
  );
});
