---
title: Admin Access Control
type: security-policy
status: current
authority: normative
---

# Admin Access Control

## 개요

관리자 로그인은 `ADMIN_ID`/`ADMIN_PASSWORD` 환경변수를 사용하지 않고, 별도 관리자 비밀번호도 없다. 관리자는 회원 계정에 `admin_profiles`(권한 템플릿·관리 캠퍼스·`permission_version`)가 연결된 회원이며, 회원 로그인 뒤 `/admin/session` 브리지로 관리자 세션을 받는다.

권한은 권한 템플릿의 리소스별 CRUD 매트릭스로 판정한다. 로그 리소스는 감사 증적 보호를 위해 `read`만 허용한다.

## myknow Super Admin 승격

배포 후 service role 권한으로 1회 실행한다. 기본 대상은 기존 운영 계정인 `myknow`이다.

```bash
SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
NEXT_PUBLIC_SITE_URL="https://ssartnership.vercel.app" \
npm run bootstrap:super-admin
```

스크립트는 `admin_accounts.login_id = 'myknow'` 계정을 활성화하고 super admin 권한을 부여한다. 기존 DB 계정이 있으면 비밀번호와 초기설정 상태는 건드리지 않는다. 계정이 아직 DB에 없을 때만 `myknow` 계정을 만들고 `/admin/setup/[token]` 초기설정 링크를 출력한다. 토큰은 평문으로 저장하지 않고 SHA-256 hash만 DB에 저장하며 7일 뒤 만료된다.

다른 계정을 대상으로 승격해야 할 때만 아래 값을 명시한다.

```bash
ADMIN_BOOTSTRAP_LOGIN_ID="other-admin" \
ADMIN_BOOTSTRAP_DISPLAY_NAME="다른 관리자" \
ADMIN_BOOTSTRAP_EMAIL="other@example.com" \
npm run bootstrap:super-admin
```

## 관리자 세션 수명

- 관리자 세션은 회원 세션에서 `/admin/session` 브리지로만 발급된다. 브리지는 회원 세션이 관리자 세션 TTL보다 오래됐으면 재로그인을 요구한다([관리자 로그인 보안 강화](./admin-login-hardening.md)).
- 관리자 세션은 요청마다 자신을 발급한 회원 세션(같은 회원, 현재 `auth_session_version`)이 유효한지 함께 확인한다. 회원이 로그아웃하거나 비밀번호를 바꿔 `auth_session_version`이 올라가면 모든 기기의 관리자 세션도 즉시 무효가 된다.
- 회원 로그아웃은 `auth_session_version`을 올려 그 계정의 모든 기기 세션을 끝낸다(운영 결정: 기기별 로그아웃 대신 전체 무효화).

## 권한 비트와 실제 통제

- 리소스별 CRUD 비트 중 서버 가드가 실제로 검사하는 비트만 `ADMIN_PERMISSION_SUPPORTED_ACTIONS`(`src/lib/admin-permissions.ts`)에 둔다. 목록 밖의 비트는 템플릿·저장 행·폼 입력과 관계없이 항상 `false`로 정규화된다.
- 예: 알림 `update`, 리뷰 `create`, 기수 `create`, 수료생 인증·프로필 사진 `create`/`delete`, 가입 승인 요청 `create`/`delete`, 알림 템플릿 `create`는 검사하는 코드가 없으므로 부여되지 않는다.
- 새 가드가 새 비트를 검사하거나 기존 가드를 없애면 같은 변경에서 지원 목록을 고친다. `tests/admin-permissions.test.mts`가 가드 호출과 지원 목록의 불일치를 실패로 막는다.
- 관리자 API route는 `getAdminSession()`과 `canAdmin()`을 직접 조합하지 않고 `ensureAdminApiPermission()` 또는 `getAdminApiPermissionSession()`을 써서 거부 시 `admin_access` 보안 로그를 남긴다.

## 운영 원칙

- 활성 최고권한 관리자는 최소 1명 이상 유지한다.
- 자기 자신의 `admin_management.update` 권한 제거와 마지막 최고권한자 비활성화는 서버와 DB trigger에서 차단한다.
- 일반 관리자 생성은 `/admin/admins`에서 템플릿을 적용한 뒤 필요한 권한만 개별 조정한다.
- 권한 변경 후 기존 세션은 `permission_version` 불일치로 무효화된다.
