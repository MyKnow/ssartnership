# 2026-07-14 Dev → Main 운영 반영 및 이슈 종료 체크리스트

최종 수정: 2026-07-14

이 문서는 현재 `dev` 변경사항을 `main`(Production)으로 승격하고, 관련 GitHub Issue를 증빙에 따라 종료하기 위한 릴리스 체크리스트다. 실제 승격 직전에 아래 기준 SHA, 이슈 상태, Preview 결과를 다시 확인한다. `dev`가 추가로 변경되면 이 문서의 기준 정보는 재검증해야 한다.

## 현재 기준 상태

| 항목 | 확인 결과 |
| --- | --- |
| `origin/dev` 기준 SHA | `88d9e67` (`feat: 관리자 직접 회원 생성 지원`) |
| `origin/main` 기준 SHA | `f892e64` |
| 브랜치 차이 | `dev`가 `main`보다 10개 커밋 앞섬, `main` 단독 커밋 없음 |
| 병합 충돌 | `git merge-tree` 기준 충돌 없음 |
| 앱 버전 | 두 브랜치 모두 `1.11.5` |
| Preview 배포 | [Vercel Preview](https://ssartnership-git-dev-myknows-projects.vercel.app) `READY` (`88d9e67`) |
| Preview DB 반영 | [Preview Supabase migration 실행](https://github.com/MyKnow/ssartnership/actions/runs/29313305507) 성공 |

이번 승격 범위에는 관리자 직접 회원 생성, 사진 제출 유도 로그인 후 RSC 반복 요청 제거, 사진 관리·대량 초대·이벤트 로그 수집·신규 가입 프로필 사진·홈 필터 동작 개선과 관련 Supabase 마이그레이션이 포함된다.

적용 대상 마이그레이션은 다음과 같다.

- `20260714111459_add_manual_member_bulk_import.sql`
- `20260714124403_harden_product_event_ingestion.sql`
- `20260714153509_add_manual_member_login_id.sql`

## 1. 승격 전 `dev` 동결 및 로컬 검증

- [ ] `git fetch origin` 후 `origin/dev`, `origin/main`의 SHA와 커밋 차이를 다시 확인한다.
- [ ] `git status --short`가 이번 릴리스 범위 외의 변경을 포함하지 않는지 확인한다.
- [ ] 열려 있는 `dev` 대상 PR이 없는지, 또는 모두 병합·검증되었는지 확인한다.
- [ ] 릴리스 버전을 유지할지, 기능 추가에 맞춰 올릴지 결정하고 버전 변경이 있으면 별도 커밋으로 관리한다.
- [ ] 다음 검증을 현재 `dev` 기준으로 실행한다.

```bash
npm run check:lockfile
npm run validate:migrations
npm test
npm run build
npm run build-storybook
npm run test-storybook
npm run test:visual
npm run test:e2e:ci
npm audit --omit=dev --audit-level=high
```

- [ ] 실패·경고가 있으면 원인, 영향 범위, 해결 PR 또는 명시적 승인 근거를 기록한다.

## 2. Preview 통합·수동 인수 테스트

- [ ] Preview 배포 SHA가 승격하려는 `dev` SHA와 같은지 확인한다.
- [ ] Preview Supabase 마이그레이션 목록이 코드의 마이그레이션 목록과 일치하는지 확인한다.
- [ ] 일반 회원, 관리자, 사진 미제출 회원의 로그인·로그아웃·권한 전환을 각각 확인한다.
- [ ] 주요 모바일과 데스크톱 화면에서 치명적인 레이아웃·콘솔 오류가 없는지 확인한다.
- [ ] 아래 이슈별 인수 조건을 실제 Preview 계정과 데이터로 확인하고 증빙 링크를 남긴다.

## 3. 이슈별 종료 증빙

`main` 병합만으로 이슈를 자동 종료하지 않는다. 각 행의 수동 검증과 Production 확인까지 끝난 이슈만 닫는다. 상위·순회성 이슈는 모든 하위 범위 종료와 담당자 승인 전에는 `Refs #번호`로만 연결한다.

| 이슈 | Preview / Production 인수 기준 | 종료 판단 |
| --- | --- | --- |
| [#121](https://github.com/MyKnow/ssartnership/issues/121) | 사진 미제출 회원이 로그인 후 `/certification/photo`로 이동하고 흰 화면·반복 RSC 요청 없이 인증 화면이 표시된다. | 해당 흐름의 Preview·Production 증빙이 있으면 종료 가능 |
| [#119](https://github.com/MyKnow/ssartnership/issues/119) | 잘못된 이벤트 입력이 거부되고, 중복 이벤트가 안전하게 처리되며, 민감 정보 노출 없이 로그·집계가 동작한다. | 보안·정확성 검증 결과를 첨부한 뒤 종료 가능 |
| [#118](https://github.com/MyKnow/ssartnership/issues/118) | XLSX+ZIP 대량 초대, 중복·정원·이미지 검증, 생성 회원의 연락·사진 접근 경로를 확인한다. | 운영 담당자 인수 및 테스트 데이터 정리 후 종료 가능 |
| [#116](https://github.com/MyKnow/ssartnership/issues/116) | 신규 가입 회원의 Mattermost 프로필 사진이 저장·표시되고 실패 시 가입 흐름이 깨지지 않는다. | 가입부터 표시까지 Production 확인 후 종료 가능 |
| [#114](https://github.com/MyKnow/ssartnership/issues/114) | `members:create` 권한 관리자가 직접 회원을 만들고, `manual-` 로그인 ID·초기 비밀번호 정책·권한 제한이 정상 적용된다. | 생성 계정으로 실제 로그인 확인 및 테스트 계정 정리 후 종료 가능 |
| [#110](https://github.com/MyKnow/ssartnership/issues/110) | 홈 필터 변경이 즉시 반영되고 불필요한 전체 RSC 재요청·화면 깜빡임이 없다. | 모바일·데스크톱에서 확인 후 종료 가능 |
| [#103](https://github.com/MyKnow/ssartnership/issues/103) | 공통 프로필 사진 검토와 인증 차단 정책이 권한·예외 흐름까지 일관되게 동작한다. | 정책 시나리오 전수 확인 후 종료 가능 |
| [#102](https://github.com/MyKnow/ssartnership/issues/102) | 수료생 증명서·사진 인증, 이메일 계정, 검토·계정·카드 흐름을 실제 데이터로 확인한다. | 전체 플로우 인수 후 종료 가능 |
| [#94](https://github.com/MyKnow/ssartnership/issues/94) | 기수별 카드 색상 CRUD, 대비, 반응형 화면과 기존 기수 데이터 호환성을 확인한다. | 관리자·사용자 화면 확인 후 종료 가능 |
| [#97](https://github.com/MyKnow/ssartnership/issues/97) | 전면 IA·화면 계약 리팩터링의 남은 범위, 회귀, 문서화가 완료되었는지 담당자가 승인한다. | 상위 이슈이므로 하위 범위가 모두 끝나기 전에는 종료하지 않음 |
| [#54](https://github.com/MyKnow/ssartnership/issues/54) | UI/UX·기능·성능 보완 순회의 미해결 항목이 없고 운영 담당자가 완료를 승인한다. | 순회성 상위 이슈이므로 이번 승격만으로 자동 종료하지 않음 |

## 4. `dev` → `main` 승격 PR

- [ ] `dev`를 base로 하지 않고 `main`을 base로 하는 승격 PR을 만든다.
- [ ] PR 설명에 Summary, Related Issue, Branch Flow, Changes, Test Plan, Checklist를 포함한다.
- [ ] 개별 완료 이슈만 `Closes #번호`로 연결하고, #54·#97 같은 상위 이슈는 `Refs #번호`로 연결한다.
- [ ] 검토자 승인, 필수 CI, Preview 인수 결과가 모두 충족되었는지 확인한다.
- [ ] 배포 후 추적하기 쉽도록 병합 방식과 병합 SHA를 PR·이슈에 기록한다.

## 5. Production DB·Vercel 배포 순서

> **주의:** Production Supabase 마이그레이션은 [`production-migrations.yml`](../../.github/workflows/production-migrations.yml)의 수동 실행(`workflow_dispatch`)이다. `main` 병합에 따른 Vercel 코드 배포가 먼저 시작될 수 있으므로, 스키마 의존 변경은 반드시 배포 순서와 짧은 불일치 구간의 안전성을 확인한 뒤 진행한다.

- [ ] 배포 담당자, 배포 시간, 롤백 담당자와 연락 경로를 정한다.
- [ ] 새 컬럼·테이블이 없는 상태에서도 새 코드가 안전하게 동작하는지 확인하거나, 승인된 마이그레이션 우선/점검 창 전략을 선택한다.
- [ ] 백업·복구 가능 여부와 실패 시 되돌릴 코드 SHA를 기록한다.
- [ ] `main` 병합 후 GitHub Actions에서 **Apply Production Supabase Migrations**를 실행하고 `APPLY_PRODUCTION_MIGRATIONS` 확인 입력을 명시한다.
- [ ] 마이그레이션 적용 전후 `supabase migration list` 결과가 기대값과 같은지 확인한다.
- [ ] Vercel Production 배포가 병합 SHA로 `READY`인지 확인한다.
- [ ] Production에서 로그인, 사진 인증 진입, 관리자 회원 생성, 홈 필터, 관리자 사진·초대 주요 경로를 스모크 테스트한다.
- [ ] Vercel·Supabase 오류 로그와 제품 이벤트 수집 상태를 최소 15~30분 관찰한다.

## 6. 이슈 종료와 릴리스 정리

- [ ] 각 이슈에 승격 PR, Production 배포 SHA, Production migration 실행, 테스트 또는 인수 증빙 링크를 댓글로 남긴다.
- [ ] 재현 절차·기대 결과·실제 결과·확인자·확인 시각을 간단히 남긴다.
- [ ] 이 문서의 이슈별 종료 판단을 모두 충족한 이슈만 닫는다.
- [ ] #54·#97 등 상위 이슈는 남은 작업을 하위 이슈로 분리하거나 담당자의 명시적 완료 승인을 받은 뒤 닫는다.
- [ ] 임시 테스트 회원·업로드 파일·테스트 초대 데이터가 남지 않았는지 확인한다.
- [ ] 배포 후 발견한 회귀는 새 이슈로 기록하고, Production에 영향을 주면 `main`에서 `hotfix/*` 브랜치로 처리한 뒤 `dev`에도 동기화한다.

## 완료 기록 템플릿

각 이슈의 종료 댓글에는 아래 형식을 사용한다.

```md
## 운영 반영 확인

- 승격 PR: <링크>
- Production 배포 SHA: `<sha>`
- Production DB migration: <실행 링크 또는 해당 없음>
- 검증 일시 / 확인자: <KST 시각> / <이름>
- 검증 결과: <재현 절차와 실제 결과>
- 모니터링: <15~30분 오류·로그 확인 결과>
```
