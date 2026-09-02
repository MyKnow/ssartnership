---
title: 기술 부채 추적기
type: tech-debt
status: active
authority: descriptive
last_verified: 2026-08-29
---

# 기술 부채 추적기

이 문서는 아직 실행 승인을 받지 않은 교차 영역 후보만 기록한다. 구체적인 구현을 시작하기 전 GitHub Issue로 승격하고, 실행 중에는 active plan을 사용한다.

## 확인이 필요한 후보

### DB Schema-Service 후속 wave

- 이전 계획의 wave 1~10은 완료됐다.
- wave 11 표기는 남아 있지만 범위와 우선순위가 정의되지 않았다.
- 새 작업을 시작하기 전에 현재 query 측정, 실제 코드 경계, 기존 Issue 중복을 다시 확인한다.

### Push service와 관리자 UI 분해

- 완료된 리팩터링 배치에는 `src/lib/push.ts`, `AdminPushManager`, `PushSettingsCard`가 후속 후보로 남아 있었다.
- 현재 파일 책임과 변경 빈도를 다시 측정한 뒤 필요할 때 새 Issue로 승인한다.

### 문서 freshness 연동

- `source_paths`가 바뀌었지만 관련 descriptive 문서가 갱신되지 않은 경우를 자동으로 경고하는 기능은 후속 후보로 둔다.
- 단순 경로 변경이 거짓 양성을 만들 수 있으므로 현재 문서 검증기는 metadata, 구조, 링크, 탐색 가능성만 fail-closed로 검사한다.
