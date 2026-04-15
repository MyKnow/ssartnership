# 리팩토링 배치 기록

## Batch 1 (완료)
- 대상
  - `src/app/admin/(protected)/actions.ts`
- 수행
  - 관리자 서버 액션을 `_actions/account-actions.ts`, `_actions/catalog-actions.ts`, `_actions/partner-actions.ts`, `_actions/member-actions.ts`, `_actions/cycle-actions.ts`로 분리했다.
  - 공통 타입/파서/리다이렉트/감사 로그/미디어 처리 로직을 `_actions/shared-types.ts`, `_actions/shared-parsers.ts`, `_actions/shared-helpers.ts`, `_actions/partner-support.ts`로 이동했다.
  - 기존 import surface는 유지하고, `actions.ts`는 얇은 wrapper와 `logout()`만 남겼다.
  - 분리 과정에서 계정 이메일 정규화와 초기설정 링크 발급 검증을 원본 동작과 동일하게 보정했다.
- 결과
  - `src/app/admin/(protected)/actions.ts`: `2229 -> 144` lines

## Batch 2 (완료)
- 대상
  - `src/components/admin/AdminLogsManager.tsx`
  - `src/lib/log-insights.ts`
- 수행
  - 로그 UI용 타입/포맷터/라벨 맵을 `src/components/admin/logs/types.ts`, `src/components/admin/logs/utils.ts`로 분리했다.
  - 요약 카드/차트/CSV 다이얼로그를 `src/components/admin/logs/AdminLogsPanels.tsx`로 분리했다.
  - 필터/목록/상세 렌더링을 `src/components/admin/logs/AdminLogsExplorer.tsx`로 분리했다.
  - 로그 데이터 계층을 `src/lib/log-insights/shared.ts`, `src/lib/log-insights/range.ts`, `src/lib/log-insights/data.ts`, `src/lib/log-insights/csv.ts`로 분해했다.
  - `src/lib/log-insights.ts`는 public export와 orchestration만 남기는 façade로 축소했다.
- 결과
  - `src/components/admin/AdminLogsManager.tsx`: `1464 -> 692` lines
  - `src/lib/log-insights.ts`: `797 -> 80` lines

## Batch 3 (완료)
- 대상
  - `src/lib/partner-change-requests.ts`
  - `src/lib/mock/partner-change-requests.ts`
  - `src/app/partner/services/[partnerId]/request/actions.ts`
- 수행
  - 실제 구현을 `src/lib/partner-change-requests/shared.ts`, `normalizers.ts`, `summary.ts`, `context.ts`, `immediate.ts`, `commands.ts`, `repository.ts`로 분리했다.
  - mock 구현을 `src/lib/mock/partner-change-requests/shared.ts`, `normalizers.ts`, `service-store.ts`, `context.ts`, `immediate.ts`, `commands.ts`로 분리해 실제 구현과 같은 책임 경계를 맞췄다.
  - 파트너 요청 서버 액션을 `src/app/partner/services/[partnerId]/request/_actions/shared.ts`, `media.ts`, `immediate.ts`, `approval.ts`, `cancel.ts`로 나눴다.
  - 기존 public import surface와 redirect 규칙, media upload/rollback 동작은 유지하고, 상위 파일들은 façade와 orchestration만 남겼다.
- 결과
  - `src/lib/partner-change-requests.ts`: `1219 -> 30` lines
  - `src/lib/mock/partner-change-requests.ts`: `918 -> 19` lines
  - `src/app/partner/services/[partnerId]/request/actions.ts`: `342 -> 17` lines

## Batch 4 (완료)
- 대상
  - `src/components/admin/PartnerMediaEditor.tsx`
  - `src/components/PartnerCardForm.tsx`
  - `src/components/admin/AdminPartnerManager.tsx`
- 수행
  - 미디어 편집기를 `src/components/admin/partner-media-editor/` 하위의 `types`, `utils`, `useMediaFieldController`, `MediaCardToolbar`, `MediaCropModal`, `MediaField`, `ThumbnailField`, `GalleryField`로 분리했다.
  - 브랜드 폼을 `src/components/partner-card-form/` 하위의 `types`, `FieldGroup`, `usePartnerCardFormState`, `PartnerFormHero`, `PartnerBasicInfoSection`, `PartnerCompanySection`, `PartnerChipSections`, `PartnerAudienceSection`, `PartnerFormActions`, `PartnerCardForm`으로 분리했다.
  - 관리자 브랜드 관리 화면을 `src/components/admin/partner-manager/` 하위의 `types`, `selectors`, `AdminPartnerManagerFilters`, `AdminPartnerManagerList`로 분리했다.
  - 상위 파일은 façade/orchestration만 남기고, public import surface와 form field name, media manifest wire shape는 유지했다.
  - 순수 helper를 대상으로 `tests/batch4-refactor.test.mts`를 추가해 media reorder/manifest, form-state derivation, admin selector filter/sort를 node test로 고정했다.
- 결과
  - `src/components/admin/PartnerMediaEditor.tsx`: `1039 -> 20` lines
  - `src/components/PartnerCardForm.tsx`: `591 -> 16` lines
  - `src/components/admin/AdminPartnerManager.tsx`: `258 -> 103` lines

## 다음 배치 후보
1. `src/lib/push.ts`
2. `src/components/admin/AdminPushManager.tsx`
3. `src/components/push/PushSettingsCard.tsx`
