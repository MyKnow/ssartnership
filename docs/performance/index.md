---
title: 성능 지식 인덱스
type: index
status: current
authority: normative
last_verified: 2026-08-29
---

# 성능 지식 인덱스

## Baselines

- [Speed Insights 기준선](./baselines/2026-04-03-speed-insights.md)
- [관리자 콘솔 측정 기준](./baselines/admin-console.md)
- [클라이언트 번들 기준선과 측정 절차](./baselines/2026-10-05-client-bundle.md)

## Measurements and reports

- [Speed Insights 배포 후 측정](./measurements/speed-insights.md)
- [DB query 최적화 보고서](./reports/db-query-optimization.md)

## Point-in-time audits

- [2026-04-10 프로젝트 전반 감사](./audits/2026-04-10-project-wide.md)
- [2026-07-21 schema·API·async·CI 감사](./audits/2026-07-21-schema-api-async-ci.md)
- [2026-07-29 Issue #181 최종 감사](./audits/2026-07-29-issue-181-final.md)

새 개선 주기에서는 변경 전 기준선을 남기고, 배포와 실제 traffic 수집 뒤 측정 결과를 추가한다. 과거 감사의 숫자를 현재 production 수치로 재사용하지 않는다.

## 자체 호스팅 캐시 전제

- edge·relay Caddy에는 공유 HTTP 캐시가 없다. 공개 응답의 `s-maxage`·`stale-while-revalidate`는 소비자가 없으므로 쓰지 않고, 브라우저와 Next 이미지 옵티마이저가 읽는 `max-age`만 정책으로 관리한다(`src/lib/public-cache-control.ts`).
