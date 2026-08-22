# main/dev 재동기화와 Production 승격 준비

작성일: 2026-08-13
관련 이슈: [#310](https://github.com/MyKnow/ssartnership/issues/310)

## 목적

장기간 분기된 `main`과 `dev`의 공통 조상을 다시 연결해 이후 `dev` → `main` Production 승격에서 같은 충돌을 반복하지 않도록 한다. 이 문서의 재동기화는 `main`을 배포하거나 Production 데이터·설정을 변경하지 않는다.

## 재동기화 기준

- 첫 번째 부모: `origin/dev` `44b634850d0ebd...`
- 두 번째 부모: `origin/main` `af125708e55023d...`
- 통합 브랜치: `chore/310-main-dev-reconciliation`
- 최종 파일 트리: 현재 `dev`의 제품 코드와 동일하며, 이 운영 문서만 추가

`main`의 관리자 쿠폰 삭제 안전화 계약은 이미 `dev`의 상위 구현에 포함되어 있었다. 따라서 기능 코드를 과거 버전으로 되돌리지 않고 두 브랜치의 이력만 연결했다.

### 필수 병합 방식

#310은 GitHub의 **Create a merge commit** 방식으로만 `dev`에 병합한다. Squash merge나 rebase merge를 사용하면 `origin/main`이 두 번째 부모라는 이력이 사라져 브랜치 공통 조상이 복구되지 않고, 다음 `dev` → `main` 승격에서 같은 충돌을 다시 만날 수 있다.

병합 직후 생성된 `dev` 커밋에 부모가 두 개이고 그중 하나가 위 `origin/main` 기준 커밋인지 확인한 뒤 Preview 검증을 진행한다.

## 충돌 해결 결정

| 파일 | 결정 | 보존한 계약 |
| --- | --- | --- |
| `.github/workflows/admin-performance.yml` | `dev` 채택 | 수동·`dev` 한정 실행과 확인 문자열, page/API target, 로그인·Basic Auth probe |
| `docs/product/screen-specs/admin.md` | `dev` 채택 | 이력 있는 쿠폰 삭제 금지, 제휴처 기본 편집과 운영 상세 분리, 지연 로딩 |
| `src/app/admin/(protected)/partners/[partnerId]/page.tsx` | `dev` 채택 | 쿠폰 CRUD 안전 오류, 권한 분리, 운영 정보·감사·리뷰의 독립 `Suspense` |
| `src/components/admin/ad-packages/AdminPartnerCouponManager.tsx` | `dev` 채택 | 발급·사용 이력 삭제 차단과 유효한 `InlineMessage` danger tone |
| `tests/ad-coupon-ui-contract.test.mts` | `dev` 채택 | `main`의 삭제 차단 assertion과 `dev`의 전체 CRUD 안전 오류 계약 |

자동 병합 과정에서 동일한 `DeleteBlockedByHistory` Story가 중복된 파일은 단일 export로 정리했다. 결과는 병합 전 `dev` 내용과 같다.

## 검증 증거

Node.js 24.19 환경에서 다음을 확인했다.

- 충돌 관련 집중 테스트: 46/46
- Node 테스트: 1,092/1,092
- unit 테스트: 61/61, coverage 98.5%
- Playwright E2E: 86/86
- lockfile canonical 검사, migration 160개 검증, lint, typecheck, production build: 통과
- Production dependency audit: 취약점 0건
- 미해결 index entry와 conflict marker: 0건

Lint에는 이 작업과 무관한 `tests/admin-log-export-security-contract.test.mts`의 미사용 import 경고 1건만 남아 있으며 오류는 없다.

## 병합 후 Preview 확인

1. #310 PR의 필수 검사가 모두 성공했는지 확인한다.
2. **Create a merge commit**으로 병합하고 새 `dev` 커밋에 `origin/main` 이력이 부모로 보존됐는지 확인한다.
3. `dev` 병합 뒤 Vercel Preview와 Preview Supabase sync가 같은 병합 SHA로 완료됐는지 확인한다.
4. 관리자 제휴처 상세에서 쿠폰 생성·수정·복제와 이력 있는 쿠폰 삭제 차단을 확인한다.
5. 관리자 상세의 운영 정보·감사 이력·리뷰 지연 로딩 실패 상태를 확인한다.
6. `git merge-tree origin/main origin/dev`가 미해결 충돌 없이 계산되는지 확인한다.

## Production 승격 승인 체크리스트

아래 항목은 이 재동기화 PR에 포함하지 않으며, 별도의 `dev` → `main` 승격 승인 뒤 수행한다.

- [ ] Preview 핵심 회원·관리자·Apple Wallet 흐름의 smoke evidence가 최신 `dev` SHA에 연결됨
- [ ] Production 전용 환경변수, 인증서, SMTP와 Supabase migration 순서가 승인됨
- [ ] pending Production migration과 되돌리기/forward-fix 경로가 검토됨
- [ ] Vercel·Supabase 배포 담당자와 관찰 시간이 정해짐
- [ ] `dev` → `main` PR에서 전체 CI와 최종 merge tree가 다시 통과함
- [ ] 배포 후 인증, 제휴처 탐색, 관리자 작업, 이메일, Apple Wallet 발급·폐기의 smoke 결과가 기록됨

승격 중 문제가 생기면 `main`의 기존 배포를 유지하고, 데이터 파괴나 history rewrite 없이 별도 hotfix 또는 forward fix로 복구한다.
