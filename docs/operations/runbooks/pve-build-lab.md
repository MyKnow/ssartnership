---
title: 격리 PVE 빌드 실험 운영 및 복구
type: runbook
status: current
authority: normative
---

# 격리 PVE 빌드 실험 운영 및 복구

## 현재 승인 범위

Issue #497의 전용 브랜치, VM 4970 빌더와 VM 4971 합성 Preview만 대상이다. 기존 production·preview, dev·main, 운영 receiver, 공유기 및 도메인은 변경하지 않는다. 운영 전환 및 병합은 별도 승인 대상이다.

## 권장 구성과 실행 경계

- 빌더: 4 vCPU, VM 6144 MiB, 빌드 컨테이너 5120 MiB, 동시 실행 1개. 운영 VM 자원 회수 없음.
- 실험 Preview: 4 vCPU, 4096 MiB. DB·Storage·앱의 runtime network는 internal이며 공개 Docker 포트 없음.
- PVE의 root 소유 제어기는 고정 공개 저장소와 실험 브랜치를 30초마다 확인한다. 빌드 소스가 PVE 제어 코드나 자원 profile을 덮어쓰지 않는다.
- source SHA를 고정하고 전체 검사, artifact SHA-256, 이미지 revision, 실제 실행 image ID와 HTTP를 확인한다. 결과물은 재사용하지 않고 검증된 npm 및 실제 앱·fixture의 Next 캐시만 재사용한다.
- 대기열은 fast-forward 이력의 commit FIFO이며 최대 64개다. webhook push-event 큐가 아니므로 한 push의 여러 commit은 여러 번 빌드될 수 있다. 실패/모호한 실행은 자동 재시도하지 않는다.
- 대기 작업이 없으면 배포 완료 이후 900초 유휴 시 빌더만 정상 종료한다. Preview는 유지한다.
- 설치된 제어기 service timeout은 1500초다. timer 중지는 새 tick 접수를 막을 뿐 진행 중인 빌드·전송을 취소하지 않는다.

## 캐시와 비밀값

실험 캐시는 lockfile·Node·npm 정책·Next 설정·gate image·origin fingerprint가 일치한 성공 실행에서 npm 및 두 Next 캐시만 가져온다. cold는 독립 캐시와 키, warm은 실험용 키를 재사용한다. 운영 키를 실험 VM으로 복사하지 않는다. 운영 적용 시에는 빌드 전용 키의 저장·접근·회전 정책을 별도로 승인하고, 실험에서 만든 키나 합성 env를 운영에 승격하지 않는다.

## 전환안 검토 순서

1. 반복 계측과 복구 검증 결과를 검토하고, 빌드만 전환할지 서비스도 이전할지 승인 범위를 정한다.
2. 기존 GitHub gate와 검사 목록을 유지한 채 운영용 실행 ref·권한·이미지 namespace·배포 대상 매핑을 검토한다. 실험 receiver를 운영 신호에 단순 연결하지 않는다.
3. 서비스 이전을 승인하면 실험 seed가 없는 별도 대상에 운영 백업을 복원하고 데이터·Storage·권한·외부 작업 설정을 검증한다. 원본은 유지한다.
4. 운영 receiver와 배포 접근 경로, 필요한 자격증명만 별도 승인 후 연결한다. 현재 문서는 운영 실행 명령이나 운영 비밀값을 포함하지 않는다.
5. 작은 변경으로 승인된 대상의 SHA·검사·실제 응답을 확인한다. 실패하면 기존 GitHub/receiver 경로와 기존 서버를 계속 사용한다.

## 실험 앱 복구 절차

1. PVE identity preflight를 통과한 뒤 `build-lab-497-controller.timer`를 중지한다. service와 guest build unit이 terminal 상태가 될 때까지 관측하며 실행을 강제 종료하지 않는다.
2. host delivery 및 Preview receipt에서 이전에 승인된 SHA·archive digest·image ID를 선택한다. audit 오류로 거부된 `5065fe30`은 복구 후보가 아니다.
3. 해당 Preview receipt를 별도 복구 evidence 디렉터리에 보존한다. root incoming archive의 digest를 검증한 뒤 root 소유 `preview_deploy.py`에 정확한 SHA와 digest를 전달한다. 이 명령은 앱만 바꾸며 migration 또는 seed를 실행하지 않는다.
4. 실행 이미지 ID와 revision, health·합성 상세 응답, DB/Storage 영속성을 확인한다. rollback 자체의 별도 receipt를 보관한다.
5. 최신 검증 이미지에도 같은 절차를 적용해 원복한 다음 timer를 재개한다. 실패하면 timer를 멈춘 상태로 보존하고 실패 이력을 덮어쓰지 않는다.

실제 이전 이미지 rollback과 최신 이미지 복원, 정식 12회 및 warm 대조군 3회는 검증했다. [측정 및 복구 증거](../../performance/measurements/pve-build-lab-2026-09-27.md)를 참조한다. 최종 게시 SHA의 대기열·브라우저·유휴 종료 검증은 [Issue #497](https://github.com/MyKnow/ssartnership/issues/497)의 최종 기록을 확인한다.

## 상태 확인과 중지 경계

관리 Mac에서 PVE skill의 identity preflight를 먼저 수행한다. 아래 조회는 비밀값이 들어 있는 env 파일을 출력하지 않는다.

```sh
ssh pve-agent 'sudo -n systemctl is-active build-lab-497-controller.timer'
ssh pve-agent 'sudo -n cat /var/lib/build-lab-497/state.json'
ssh pve-agent 'sudo -n qm status 4970'
ssh pve-agent 'sudo -n qm status 4971'
```

`state.json`의 `lastAttempt`, `deploymentAttempt`, `deploymentStatus`, `pending`을 함께 읽는다. 과거 audit 준비 실행을 거부하며 남긴 `operatorRejection` 필드는 이전 사건의 기록이며, 현재 SHA의 승인 여부는 해당 SHA의 rejection/delivery/result와 함께 판단한다. timer가 active라는 사실만으로 빌드나 배포 성공을 주장하지 않는다.

의도적으로 접수를 멈출 때는 preflight 후 PVE의 `build-lab-497-controller.timer`를 중지하고 controller service의 `MainPID=0`과 guest agent의 `busy=false`를 확인한다. timer 중지만으로 실행 중 작업이 취소되지는 않는다. 실패 SHA를 삭제하거나 state를 되감아 같은 작업을 성공할 때까지 반복하지 않는다. 로그·result·시각과 배포 여부를 보존한 뒤 원인을 검토하고 별도의 새 SHA를 사용한다.

## 디스크 및 캐시 보존

빌더 디스크는 80 GiB이며 검증된 작업도 source/image archive, 로그, 결과, 생성 work가 누적된다. 자동 무제한 보존에 따른 디스크 위험을 방치하지 않는다. 용량 정리는 controller와 guest가 유휴인 상태에서 완료·검토된 명시적 run 목록만 대상으로 한다. 원본 archive·결과·로그를 보존하고 현재 성공 작업과 다음 warm 실행이 참조하는 작업, 실패/거부 작업은 삭제하지 않는다. 전역 Docker prune이나 물리 디스크 초기화는 이 절차에 포함하지 않는다. 본 실험의 준비 스크립트는 다음 요청 전 여유 공간 8 GiB 미만이면 중단한다. 현재 배포 제어기 자체에 자동 retention/용량 정리 기능이 구현됐다는 뜻은 아니다.

## 운영 도입 전 미해결 항목

cold 의존성 설치에서 연결 reset 실패 3건이 관측됐다. 개별 패키지 전송 성공과 이후 표본 성공만으로 원인이 해결된 것은 아니다. 실패가 배포로 이어지지 않는 경계는 확인했지만, 운영 도입 전 이 설치 경로의 안정성을 별도로 검토해야 한다. 초기 측정의 audit wrapper 한계, 정적 파일 변경에 한정한 전체 경로 workload, 고정 NIC 제한, 소비전력 미측정 등의 한계도 측정 문서와 함께 판단한다.
