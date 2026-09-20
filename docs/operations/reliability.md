---
title: 신뢰성 판단과 복구 기준
type: runbook
status: current
authority: normative
---

# 신뢰성 판단과 복구 기준

회원 로그인·허용 혜택 조회·관리자 업무·업로드·외부 발송·배포와 복구를 독립적으로 판단한다.

| 확인 대상 | 성공 근거 | 실패 대응 정본 |
| --- | --- | --- |
| 앱 | exact SHA/image, health, 공개 URL, 필요한 인증 과업 | [배포·rollback](./runbooks/self-host-ci-maintenance.md) |
| DB·Storage | 적용 schema와 복원 목록·객체 동등성 | [데이터 운영](./runbooks/self-host-database.md) |
| 백업·외부 사본 | 최근 성공 시각, 검증 가능한 사본, 복원 시험 | [백업](./runbooks/self-host-operations.md), [외부 사본·관측](./runbooks/self-host-observability.md) |
| 외부 전달 | 요청 접수와 provider 전달 결과 구분 | [API](../architecture/api-and-integrations.md), [로그](../architecture/event-logging.md) |

가용성·RTO·RPO 목표는 측정 근거와 운영 승인이 있어야 한다. 이 정비에서는 새 목표 수치를 승인하지 않는다. 미정 목표를 충족한 것으로 보고하지 않는다.

Runbook은 대상 환경·필요 권한·선행 조건·부작용·성공·중단·복구 조건을 포함한다. 실제 장애가 생기면 시각·영향·원인·복구·재발 방지를 시점 기록으로 남기며, 평소 절차 정본과 분리한다.
