---
title: Production·Preview PVE 이전 명세
type: feature-spec
status: current
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/523
---

# Production·Preview PVE 이전

## 결과와 범위

노트북의 실제 Production과 원본 Preview를 기존 단일 PVE의 독립 VM으로 이전한다. Production은 2 vCPU·4GiB·80GiB, 개인용 Preview는 1 vCPU·2GiB·40GiB, 공용 ingress와 감시는 1 vCPU·2GiB·32GiB로 시작한다. 빌드는 기존 GitHub CI에서 수행한다. 두 번째 PVE 노드·HA·노트북 초기화·공유기 NAS 구축은 별도 작업이다.

## 불변조건

- 원래 DB·Storage·회원 인증 자료·환경별 비밀·이미지 digest·migration checksum을 보존한다. Production 데이터를 정제해 Preview를 새로 만드는 작업이 아니다.
- 승인된 새 VM 5200·5201·5202의 디스크만 생성한다. 기존 게스트·호스트 디스크·백업을 삭제하거나 포맷하지 않는다.
- 준비와 복원 시험 동안 기존 서비스를 유지한다. 최종 일관성 확보를 위한 쓰기 중단은 검증된 대상·백업·복귀 절차가 갖춰진 뒤 수행한다.
- 공개 API·TLS·관리자 인증 경계를 유지한다. DB와 수집기 포트는 외부 인터넷에 공개하지 않는다.
- 환경별 자동 배포·예약 작업·백업 생성의 소유자는 한 곳이다. 대상 쓰기 개시 이후에는 변경분 조정 없이 원본으로 돌아가지 않는다.
- Mac의 외부 암호화 백업과 키 보관 경계를 유지한다. 같은 PVE의 SATA 백업을 독립 장애 영역으로 간주하지 않는다.
- 기존 ingress를 공유하는 다른 서비스의 주소를 보존한다.

## 수용 기준

1. 세 VM의 자원·실제 파일 시스템·부팅 복구가 승인된 구성과 일치한다.
2. 모든 사용자 테이블과 Storage 파일을 원본의 일관된 snapshot과 전량 대조한다. 복원 시험은 새 private 경로에서 수행한다.
3. 실제 Preview를 1 vCPU·2GiB에서 실행하고 HTTP·인증·Storage·자원 상태를 확인한다.
4. Production 전환 후 공개 HTTPS, 앱·API health, 대표 인증 흐름, 배포 수신기 상태를 별도로 확인한다.
5. 공용 감시에서 두 환경을 구분하고 관리 인증을 확인한다. 서버 밖의 장애 감시는 별도 증거로 보고한다.
6. 신규 Production 백업의 암호문을 Mac에 보관하고 실제 복구 가능성을 검증한다.
7. 현재 소스 SHA·이미지·자동화 소유자·전환 시각·잔여 사항을 작업 목록에 기록한다.

[기술 계획](./plan.md), [작업 목록](./tasks.md).


## 공용 감시 보완의 승인 범위

2026-10-02에 사용자가 공용 Grafana/경보 구조 구현을 승인했다. Production·Preview와 공용 감시, 물리 PVE, 실제 snapshot/copy/restore, 사용자 체감 성능, 알림 자체 상태를 분리해서 보여준다. 발송은 VM 5202의 전용 notifier로 이동하고 기존 운영자 메일 및 그 운영자만의 기존 PWA 구독을 재사용한다. Preview 장애는 warning 이메일만 발송한다. 기존 앱 이미지·데이터·관리 계정·공개 인증 범위는 유지한다.

Better Stack 가입을 진행할 수 없다는 사용자 응답에 따라 Healthchecks.io 외부 heartbeat/Gmail 알림을 대체 경로로 구성한다. 이는 PVE 전체 정지의 통보 경계이며 독립 외부 HTTPS polling과 구분한다. 사용자는 호스트 1분 수집 서비스와 source IP·전용 token으로 보호한 `/infra/host-metrics` 입력 경로를 별도로 승인했다. 보호된 물리 디스크에 대해서는 SMART/read-only 보고만 허용한다.

추가 수용 기준은 인증 경계·안전한 payload·실제 Alertmanager 발생/복구 전달, rule unit test, 모든 target/rule 정상, 데이터 없음/표본 부족/미연동의 정직한 표시, 호스트 수집·복원 proof의 신선도, 360/820/1440px Grafana 렌더링이다. 실제 수신함·아이폰 도착은 제공자 접수와 별개이며 확인 전 완료로 표시하지 않는다. 구현·운영·metric 계약은 [공용 감시 runbook](../../operations/runbooks/self-host-observability.md#pve-공용-감시와-운영자-알림)이 source of truth다.
