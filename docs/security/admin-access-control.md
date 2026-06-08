# Admin Access Control

## 개요

관리자 로그인은 `ADMIN_ID`/`ADMIN_PASSWORD` 환경변수를 사용하지 않는다. 모든 관리자 계정은 Supabase `admin_accounts`에 저장하고, 비밀번호는 `password_hash`/`password_salt`로만 보관한다.

권한은 `admin_permissions`의 리소스별 CRUD 매트릭스로 판정한다. 로그 리소스는 감사 증적 보호를 위해 `read`만 허용한다.

## myknow00 Super Admin 승격

배포 후 service role 권한으로 1회 실행한다. 기본 대상은 기존 운영 계정인 `myknow00`이다.

```bash
SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
NEXT_PUBLIC_SITE_URL="https://ssartnership.vercel.app" \
npm run bootstrap:super-admin
```

스크립트는 `admin_accounts.login_id = 'myknow00'` 계정을 활성화하고 super admin 권한을 부여한다. 기존 DB 계정이 있으면 비밀번호와 초기설정 상태는 건드리지 않는다. 계정이 아직 DB에 없을 때만 `myknow00` 계정을 만들고 `/admin/setup/[token]` 초기설정 링크를 출력한다. 토큰은 평문으로 저장하지 않고 SHA-256 hash만 DB에 저장하며 7일 뒤 만료된다.

다른 계정을 대상으로 승격해야 할 때만 아래 값을 명시한다.

```bash
ADMIN_BOOTSTRAP_LOGIN_ID="other-admin" \
ADMIN_BOOTSTRAP_DISPLAY_NAME="다른 관리자" \
ADMIN_BOOTSTRAP_EMAIL="other@example.com" \
npm run bootstrap:super-admin
```

## 운영 원칙

- 활성 최고권한 관리자는 최소 1명 이상 유지한다.
- 자기 자신의 `admin_management.update` 권한 제거와 마지막 최고권한자 비활성화는 서버와 DB trigger에서 차단한다.
- 일반 관리자 생성은 `/admin/admins`에서 템플릿을 적용한 뒤 필요한 권한만 개별 조정한다.
- 권한 변경 후 기존 세션은 `permission_version` 불일치로 무효화된다.
